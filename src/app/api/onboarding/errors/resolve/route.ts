/**
 * POST /api/onboarding/errors/resolve
 *
 * Marks Onboarding Errors rows Resolved. Supports two modes:
 *
 *   A) Single row:
 *      { errorRecordId: "recXXX", note?: string }
 *
 *   B) Lead + step sweep (RECOMMENDED from the UI):
 *      { leadRecordId?: string, email?: string, leadId?: string,
 *        step: "close_crm"|"email_validation"|"airtable_record"|"mighty_networks"|"intercom"|"vendhub",
 *        note?: string }
 *      Resolves EVERY open ("New" or "Investigating") error row that maps to the
 *      given step for that lead (match by Lead ID or Email). This is what the
 *      dashboard button uses, because the same underlying failure is often
 *      logged multiple times by n8n retries — resolving only one row
 *      leaves duplicates behind.
 *
 * Response:
 *   { success: true, resolved: <count>, ids: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, invalidateTableCache } from "@/lib/airtable";
import type { StepId } from "@/lib/pipeline";

export const maxDuration = 30;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const ERROR_TABLE_ID = "tblaQ6fpHGhRs56sH";

// Inverse of ERROR_TYPE_TO_STEP in pipeline.ts — one step can have multiple
// Airtable error type strings pointing at it.
const STEP_TO_ERROR_TYPES: Record<StepId, string[]> = {
  close_crm: ["Close CRM Update", "Close CRM Fields Empty"],
  email_validation: ["Email Validation"],
  airtable_record: ["Airtable Client Record", "Airtable Student Record"],
  mighty_networks: ["Mighty Networks invite", "Skool Invite"],
  intercom: ["Intercom Contact"],
  vendhub: ["VendHub Activation", "VendHub Subscription"],
};

interface Body {
  errorRecordId?: string;
  leadRecordId?: string;
  leadId?: string; // Close CRM lead id stored on error rows
  email?: string;
  step?: StepId;
  note?: string;
}

async function patchOne(id: string, fields: Record<string, unknown>) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ERROR_TABLE_ID}/${id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
  return res;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const note =
    body.note ||
    `Manually marked resolved from dashboard at ${new Date().toISOString()}`;

  // --- Mode A: single row by id ---
  if (body.errorRecordId && !body.step) {
    const res = await patchOne(body.errorRecordId, { Status: "Resolved", "Resolution Notes": note });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, message: `Airtable returned ${res.status}`, raw: text.slice(0, 500) },
        { status: 502 }
      );
    }
    invalidateTableCache("onboardingErrors");
    invalidateTableCache("clients");
    return NextResponse.json({ success: true, resolved: 1, ids: [body.errorRecordId] });
  }

  // --- Mode B: sweep all open rows for (lead, step) ---
  if (!body.step || !STEP_TO_ERROR_TYPES[body.step]) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing or invalid 'step'. Provide step to sweep all open error rows for that lead+step.",
      },
      { status: 400 }
    );
  }
  if (!body.leadRecordId && !body.email && !body.leadId) {
    return NextResponse.json(
      {
        success: false,
        message: "Must provide at least one of: leadRecordId, email, leadId",
      },
      { status: 400 }
    );
  }

  // Build the list of Error Type strings for this step.
  const types = STEP_TO_ERROR_TYPES[body.step];
  const emailLower = body.email?.toLowerCase().trim() || "";
  const leadIdMatch = body.leadId || "";

  try {
    // Pull every error row, bypassing cache so we include ones just logged.
    const errors = await fetchTable("onboardingErrors", {
      fields: ["Error Type", "Status", "Lead ID", "Email"],
      cacheTtl: 0,
    });

    const candidates = errors.filter((r) => {
      const f = r.fields;
      const status = (f["Status"] as string) || "";
      if (status !== "New" && status !== "Investigating") return false;
      const errType = (f["Error Type"] as string) || "";
      if (!types.includes(errType)) return false;

      const rEmail = ((f["Email"] as string) || "").toLowerCase().trim();
      const rLeadId = (f["Lead ID"] as string) || "";
      const matches =
        (emailLower && rEmail === emailLower) ||
        (leadIdMatch && rLeadId === leadIdMatch);
      return matches;
    });

    // Add the explicit errorRecordId too, even if it doesn't match (it still
    // should be swept). This handles the UI case where we pass both.
    if (body.errorRecordId && !candidates.find((c) => c.id === body.errorRecordId)) {
      candidates.push({ id: body.errorRecordId, fields: {} });
    }

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, resolved: 0, ids: [], message: "No open rows matched" });
    }

    const resolvedIds: string[] = [];
    const failures: { id: string; error: string }[] = [];

    // Airtable PATCH in batches of 10 to respect rate limits.
    for (let i = 0; i < candidates.length; i += 10) {
      const chunk = candidates.slice(i, i + 10);
      const payload = {
        records: chunk.map((r) => ({
          id: r.id,
          fields: { Status: "Resolved", "Resolution Notes": note },
        })),
        typecast: true,
      };
      const res = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ERROR_TABLE_ID}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      if (res.ok) {
        for (const r of chunk) resolvedIds.push(r.id);
      } else {
        const text = await res.text().catch(() => "");
        for (const r of chunk) failures.push({ id: r.id, error: `${res.status}: ${text.slice(0, 120)}` });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    invalidateTableCache("onboardingErrors");
    invalidateTableCache("clients");

    return NextResponse.json({
      success: failures.length === 0,
      resolved: resolvedIds.length,
      ids: resolvedIds,
      failures,
      message:
        failures.length === 0
          ? `Resolved ${resolvedIds.length} open error${resolvedIds.length === 1 ? "" : "s"} for this lead+step`
          : `Partial: ${resolvedIds.length} resolved, ${failures.length} failed`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
