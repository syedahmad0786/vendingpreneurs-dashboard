/**
 * POST /api/onboarding/resubmit
 *
 * Triggers an n8n workflow to retry a specific onboarding step for a
 * specific lead. The body looks like:
 *
 *   {
 *     leadRecordId: "recXXXX",     // Airtable record id in Student Onboarding
 *     step: "close_crm" | "email_validation" | "mighty_networks" | "intercom" | "vendhub",
 *     errorRecordId?: "recYYY",    // related Airtable error record (if any)
 *     context?: { ... }            // any extra metadata the n8n workflow needs
 *   }
 *
 * Response (proxied from n8n):
 *   { success, message, data? }
 */

import { NextRequest, NextResponse } from "next/server";
import { invalidateTableCache } from "@/lib/airtable";
import { triggerResubmit, triggerStepResubmit } from "@/lib/n8n";
import { resolveCloseLeadId } from "@/lib/close-lookup";
import type { StepId } from "@/lib/pipeline";

export const maxDuration = 30;

/** Returns true when the value looks like a Close lead id ("lead_xxxxx"). */
function isValidCloseLeadId(v: unknown): boolean {
  return typeof v === "string" && /^lead_[A-Za-z0-9]+$/.test(v.trim());
}

const VALID_STEPS = new Set<StepId>([
  "close_crm",
  "email_validation",
  "mighty_networks",
  "intercom",
  "vendhub",
]);

interface ResubmitBody {
  leadRecordId?: string;
  step?: StepId;
  errorRecordId?: string;
  context?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: ResubmitBody;
  try {
    body = (await req.json()) as ResubmitBody;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.leadRecordId) {
    return NextResponse.json(
      { success: false, message: "Missing required field: leadRecordId" },
      { status: 400 }
    );
  }
  if (!body.step || !VALID_STEPS.has(body.step)) {
    return NextResponse.json(
      {
        success: false,
        message: `Missing or invalid step. Expected one of: ${[...VALID_STEPS].join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (body.step === "vendhub") {
    return NextResponse.json(
      {
        success: false,
        message:
          "VendHub integration is pending. Once credentials are provided the step will be wired up.",
      },
      { status: 501 }
    );
  }

  // ── Auto-resolve missing Close lead id ─────────────────────────────────
  // When the dashboard fires a Retry from a New Errors / Pipeline card, the
  // context.clientId comes from whichever Airtable row the lead came in on.
  // For ghost-lead errors that originate in the Onboarding Errors table, or
  // for old Clients rows that never got their Close Lead ID backfilled, the
  // value is empty — and every per-step n8n retry workflow eventually does
  // a `https://api.close.com/api/v1/lead/{clientId}/...` call, which fails
  // with a 404 when clientId is empty and produces another "still failing"
  // row in Onboarding Errors.
  //
  // Look the lead up by email, persist what we find on the matching
  // Clients + Student Onboarding rows so the next retry has it ready, and
  // forward the enriched context to n8n.
  const incomingContext = (body.context || {}) as Record<string, unknown>;
  const incomingClientId = (incomingContext["clientId"] as string | undefined) ?? "";
  const incomingEmail = ((incomingContext["email"] as string | undefined) || "").trim();
  let closeLookup: {
    attempted: boolean;
    discoveredId?: string;
    backfilledClients?: number;
    backfilledStudents?: number;
    source?: "lookup" | "not-found" | "error";
    errorMessage?: string;
  } = { attempted: false };

  if (!isValidCloseLeadId(incomingClientId) && incomingEmail) {
    closeLookup = { attempted: true };
    try {
      const r = await resolveCloseLeadId(incomingEmail);
      closeLookup.source = r.source;
      if (r.errorMessage) closeLookup.errorMessage = r.errorMessage;
      if (r.closeLeadId) {
        closeLookup.discoveredId = r.closeLeadId;
        incomingContext["clientId"] = r.closeLeadId;
        if (r.backfill) {
          closeLookup.backfilledClients = r.backfill.clientsUpdated;
          closeLookup.backfilledStudents = r.backfill.studentsUpdated;
          if (r.backfill.clientsUpdated > 0 || r.backfill.studentsUpdated > 0) {
            invalidateTableCache("clients");
            invalidateTableCache("studentOnboarding");
          }
        }
      }
    } catch (err) {
      closeLookup.source = "error";
      closeLookup.errorMessage = err instanceof Error ? err.message : "unknown";
    }
  }

  const payload = {
    source: "dashboard_resubmit",
    leadRecordId: body.leadRecordId,
    errorRecordId: body.errorRecordId,
    step: body.step,
    context: incomingContext,
    triggeredAt: new Date().toISOString(),
    closeLookup,
  };

  // Fire-and-forget Supabase sync. Mirrors what /api/onboarding/resubmit-all
  // already does so per-step retries propagate the (possibly newly-backfilled)
  // Close Lead ID to Supabase immediately, instead of waiting on the
  // 5-minute cron or relying on the client-side triggerSupabaseSync call.
  const fireSupabaseSync = () => {
    if (!incomingEmail) return;
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/supabase/sync-lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: incomingEmail }),
    }).catch(() => undefined);
  };

  // Try the per-step webhook first, fall back to the legacy generic webhook.
  const result = await triggerStepResubmit(body.step, payload);
  if (result.success) {
    invalidateTableCache("clients");
    invalidateTableCache("onboardingErrors");
    fireSupabaseSync();
    return NextResponse.json({ ...result, closeLookup }, { status: 200 });
  }

  const fallback = await triggerResubmit(payload);
  if (fallback.success) {
    invalidateTableCache("clients");
    invalidateTableCache("onboardingErrors");
    fireSupabaseSync();
    return NextResponse.json(
      {
        ...fallback,
        message: `${fallback.message} (fallback generic webhook used — per-step n8n workflow may not be active yet)`,
        closeLookup,
      },
      { status: 200 }
    );
  }

  // Even on n8n failure, if we successfully backfilled a Close Lead ID,
  // push it to Supabase so the dashboard's Cross-platform view reflects
  // the new lookup result on the next poll.
  if (closeLookup.discoveredId) {
    fireSupabaseSync();
  }

  // Return the richer of the two failures so the UI can explain why retry failed.
  const best = fallback.raw ? fallback : result;
  return NextResponse.json(
    {
      success: false,
      message: best.message || fallback.message || result.message || "Resubmit failed",
      status: best.status,
      raw: best.raw,
      data: best.data,
      closeLookup,
    },
    { status: 502 }
  );
}
