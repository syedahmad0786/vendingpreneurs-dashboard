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

  // Build the payload the n8n workflow expects. Match the field names the
  // workflow nodes reference ($json.lead_id, $json.email, etc).
  const payload = {
    source: "dashboard:resubmit-all",
    error_record_id: errRow.id,
    lead_id: (body.leadId || (f["Lead ID"] as string) || "").trim(),
    email: (body.email || (f["Email"] as string) || "").trim().toLowerCase(),
    lead_name: (body.leadName || (f["Lead Name"] as string) || "").trim(),
    error_type: (f["Error Type"] as string) || "",
    error_node: (f["Error Node"] as string) || "",
    error_message: (f["Error Message"] as string) || "",
    timestamp: (f["Timestamp"] as string) || new Date().toISOString(),
  };

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
