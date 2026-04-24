/**
 * GET /api/onboarding/pipeline
 *
 * Returns the per-lead onboarding pipeline: one entry per row in
 * Student Onboarding, with derived status for each of the 5 steps.
 *
 * Query params:
 *   max?   — maximum leads to return (default 300)
 *   fresh  — if "1", bypasses the in-memory Airtable cache
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPipeline, STEP_ORDER } from "@/lib/pipeline";

// Fetching ~2000 rows paginated from Airtable can take 15–30s on a cold
// cache run, so bump from the default 10s Vercel serverless timeout.
export const maxDuration = 90;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const maxParam = searchParams.get("max");
    // Default: no cap (fetch everything). Pass ?max=N to limit during debugging.
    const max = maxParam ? Math.max(1, Math.min(5000, parseInt(maxParam, 10) || 300)) : undefined;
    const fresh = searchParams.get("fresh") === "1";

    const data = await fetchPipeline({ max, cacheTtl: fresh ? 0 : undefined });

    // Aggregate summary for KPI cards
    const waiting = data.filter((l) => l.overallStatus === "waiting_for_customer");
    const summary = {
      total: data.length,
      completed: data.filter((l) => l.overallStatus === "success").length,
      errored: data.filter((l) => l.overallStatus === "error").length,
      inProgress: data.filter((l) => l.overallStatus === "in_progress").length,
      waitingForCustomer: {
        // Total = unique leads waiting (a lead waiting on both MN + VendHub counts ONCE here).
        total: waiting.length,
        // Per-platform breakdown: same lead can show up in multiple of these —
        // that's intentional, so MN + VendHub sub-counts can sum to more than total.
        mightyNetworks: waiting.filter((l) => l.waitingOnMN).length,
        intercom: waiting.filter((l) => l.waitingOnIntercom).length,
        vendhub: waiting.filter((l) => l.waitingOnVendhub).length,
      },
      byStep: Object.fromEntries(
        STEP_ORDER.map((step) => {
          const counts = { success: 0, error: 0, pending: 0, waiting: 0 };
          for (const lead of data) {
            const s = lead.steps.find((st) => st.id === step);
            if (!s) continue;
            if (s.status === "success") counts.success++;
            else if (s.status === "error") counts.error++;
            else if (s.status === "waiting_for_customer") counts.waiting++;
            else counts.pending++;
          }
          return [step, counts];
        })
      ),
    };

    return NextResponse.json(
      { leads: data, summary, generatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error("[pipeline] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to load onboarding pipeline", detail: message },
      { status: 500 }
    );
  }
}
