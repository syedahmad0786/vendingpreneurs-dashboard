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
import type { StepId } from "@/lib/pipeline";

export const maxDuration = 30;

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

  const payload = {
    source: "dashboard_resubmit",
    leadRecordId: body.leadRecordId,
    errorRecordId: body.errorRecordId,
    step: body.step,
    context: body.context || {},
    triggeredAt: new Date().toISOString(),
  };

  // Try the per-step webhook first, fall back to the legacy generic webhook.
  const result = await triggerStepResubmit(body.step, payload);
  if (result.success) {
    invalidateTableCache("studentOnboarding");
    invalidateTableCache("onboardingErrors");
    return NextResponse.json(result, { status: 200 });
  }

  const fallback = await triggerResubmit(payload);
  if (fallback.success) {
    invalidateTableCache("studentOnboarding");
    invalidateTableCache("onboardingErrors");
    return NextResponse.json(
      {
        ...fallback,
        message: `${fallback.message} (fallback generic webhook used — per-step n8n workflow may not be active yet)`,
      },
      { status: 200 }
    );
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
    },
    { status: 502 }
  );
}
