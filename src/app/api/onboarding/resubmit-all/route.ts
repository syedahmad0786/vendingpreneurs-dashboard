/**
 * POST /api/onboarding/resubmit-all
 *
 * Re-runs the full onboarding pipeline for a single lead by hitting the
 * existing n8n workflow `Resubmit Student Onboarding (with mighty network)`
 * — the same workflow the Airtable "Resubmit Onboarding" button fires.
 *
 * Used by the dashboard's "New Errors" section to retry ghost-leads
 * (errors that fired before a Clients row was ever created).
 *
 * Body: { errorRecordId, email, leadName?, leadId? }
 *
 * Flow:
 *  1. Fetches the error row from Airtable (canonical source for payload)
 *  2. POSTs to n8n webhook /webhook/resubmit-onboarding
 *  3. On 2xx: marks the error row Resolved with note "Auto-resolved by
 *     dashboard resubmit at <ts>"
 *  4. Busts caches so the next dashboard poll shows the change
 */

import { NextRequest, NextResponse } from "next/server";
import { invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 60;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const N8N_BASE = process.env.N8N_BASE_URL || "https://n8n.aimanagingservices.com";
const ERROR_TABLE = "tblaQ6fpHGhRs56sH";

const N8N_WEBHOOK = `${N8N_BASE}/webhook/resubmit-onboarding`;

interface ErrRow {
  id: string;
  fields: Record<string, unknown>;
}

async function getErrorRow(id: string): Promise<ErrRow | null> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${ERROR_TABLE}/${id}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ErrRow;
}

async function markResolved(id: string, note: string): Promise<boolean> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${ERROR_TABLE}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, "content-type": "application/json" },
    body: JSON.stringify({
      fields: { Status: "Resolved", "Resolution Notes": note },
      typecast: true,
    }),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  let body: { errorRecordId?: string; email?: string; leadName?: string; leadId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.errorRecordId) {
    return NextResponse.json(
      { success: false, message: "errorRecordId is required" },
      { status: 400 }
    );
  }

  const errRow = await getErrorRow(body.errorRecordId);
  if (!errRow) {
    return NextResponse.json(
      { success: false, message: "Error row not found in Airtable" },
      { status: 404 }
    );
  }
  const f = errRow.fields;

  // Build the payload the n8n workflow expects.
  //
  // CRITICAL: the workflow's "Parse Airtable Record" node reads
  //   record.client_id, record.best_email, record.full_name
  // and "Fetch Opportunity Data1" calls Close CRM with
  //   ?lead_id={{ body.client_id }}
  // — i.e. the field names the Airtable "Resubmit Onboarding" button sends.
  //
  // If we send `lead_id` / `email` / `lead_name` (our internal names) the
  // workflow gets empty values, fires the Close CRM call with no lead id,
  // gets nothing back, and the "Close CRM Fields Empty" branch fires —
  // producing a ghost error row with empty Email/Lead Name/Lead ID. That's
  // the exact pattern we saw on 2026-05-01.
  //
  // Send both shapes so we're forwards/backwards compatible.
  const cleanLeadId = (body.leadId || (f["Lead ID"] as string) || "").trim();
  const cleanEmail = (body.email || (f["Email"] as string) || "").trim().toLowerCase();
  const cleanName = (body.leadName || (f["Lead Name"] as string) || "").trim();
  const payload = {
    source: "dashboard:resubmit-all",
    error_record_id: errRow.id,
    // Field names the Airtable button (and the n8n workflow) use:
    client_id: cleanLeadId,
    best_email: cleanEmail,
    full_name: cleanName,
    record_id: errRow.id,
    "Client ID": cleanLeadId,
    "Best Email": cleanEmail,
    "Full Name": cleanName,
    // Keep the original names for any consumer that already depends on them:
    lead_id: cleanLeadId,
    email: cleanEmail,
    lead_name: cleanName,
    error_type: (f["Error Type"] as string) || "",
    error_node: (f["Error Node"] as string) || "",
    error_message: (f["Error Message"] as string) || "",
    timestamp: (f["Timestamp"] as string) || new Date().toISOString(),
  };

  // Guard against ghost-error feedback loops. If the row has no email, no
  // Close lead id, and no real Lead Name, there is nothing for n8n to
  // resubmit — firing the webhook would cause the workflow to fail
  // validation and write yet another empty error row, then we'd see the
  // same ghost back on the dashboard. Auto-resolve and skip the webhook.
  const isPlaceholder = (v: string) => {
    const s = (v || "").trim().toLowerCase();
    return s === "" || s === "—" || s === "-" || s === "unknown";
  };
  if (
    isPlaceholder(payload.email) &&
    isPlaceholder(payload.lead_id) &&
    isPlaceholder(payload.lead_name)
  ) {
    const note = `Auto-resolved ${new Date().toISOString()} — malformed error row, no lead context (email/lead_id/lead_name all empty). n8n webhook skipped.`;
    const resolved = await markResolved(errRow.id, note);
    invalidateTableCache("onboardingErrors");
    return NextResponse.json({
      success: true,
      skippedWebhook: true,
      reason: "malformed_error_row",
      errorMarkedResolved: resolved,
      payload,
    });
  }

  // Fire the n8n webhook
  let n8nStatus = 0;
  let n8nBody = "";
  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    n8nStatus = res.status;
    n8nBody = (await res.text()).slice(0, 500);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: `Failed to reach n8n: ${err instanceof Error ? err.message : "unknown"}`,
        webhook: N8N_WEBHOOK,
      },
      { status: 502 }
    );
  }

  if (n8nStatus < 200 || n8nStatus >= 300) {
    return NextResponse.json(
      {
        success: false,
        message: `n8n returned ${n8nStatus}`,
        n8nResponse: n8nBody,
      },
      { status: 502 }
    );
  }

  // n8n accepted the resubmit — mark the error row Resolved so the
  // dashboard removes the ghost lead immediately. The workflow itself
  // will create the Clients row + verify each platform on its own
  // schedule; if anything fails the error log will refire.
  const note = `Auto-resolved by dashboard resubmit at ${new Date().toISOString()} — n8n ${n8nStatus}`;
  const resolved = await markResolved(errRow.id, note);

  // Bust caches so the change shows up on the next poll.
  invalidateTableCache("clients");
  invalidateTableCache("studentOnboarding");
  invalidateTableCache("onboardingErrors");

  // Fire-and-forget Supabase resync if we have an email
  if (payload.email) {
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/supabase/sync-lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: payload.email }),
    }).catch(() => undefined);
  }

  return NextResponse.json({
    success: true,
    n8nStatus,
    errorMarkedResolved: resolved,
    payload,
  });
}
