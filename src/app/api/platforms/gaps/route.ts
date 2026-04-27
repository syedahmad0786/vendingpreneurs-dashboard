/**
 * GET /api/platforms/gaps
 *
 * Returns the cross-platform presence matrix sourced from Supabase
 * vw_platform_gaps. Use ?bucket=... to filter to a specific cohort.
 *
 * Buckets (also used as the filter chip on the dashboard tab):
 *   fully_onboarded         in_close  ∧  in_airtable  ∧  in_mighty  ∧  in_intercom  ∧  in_vendhub
 *   close_only_or_partial   in_close  ∧  ¬(all four downstream)
 *   airtable_orphan         in_airtable  ∧  ¬in_close
 *   intercom_orphan         in_intercom  ∧  ¬in_close
 *   mighty_orphan           in_mighty    ∧  ¬in_close
 *   vendhub_orphan          in_vendhub   ∧  ¬in_close
 *   missing_close           ¬in_close
 *   missing_airtable        ¬in_airtable
 *   missing_mighty          ¬in_mighty
 *   missing_intercom        ¬in_intercom
 *   missing_vendhub         ¬in_vendhub
 */

import { NextRequest, NextResponse } from "next/server";
import { supaSelect, isSupabaseConfigured, type PlatformGapRow } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel env." },
      { status: 503 }
    );
  }

  const { searchParams } = req.nextUrl;
  const bucket = searchParams.get("bucket"); // optional
  const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get("limit") || "500", 10) || 500));

  const query: Record<string, string | number> = {
    select: "id,email,full_name,close_lead_id,airtable_id,mn_member_id,intercom_contact_id,vendhub_user_id,vendhub_org,missing_close,missing_airtable,missing_mighty,missing_intercom,missing_vendhub,classification",
    limit,
    order: "email.asc",
  };

  // Apply bucket filter via PostgREST query params
  if (bucket) {
    if (bucket.startsWith("missing_")) {
      query[bucket] = "is.true";
    } else if (bucket === "fully_onboarded" || bucket === "airtable_orphan" || bucket === "close_only_or_partial" || bucket === "intercom_orphan" || bucket === "mighty_orphan" || bucket === "vendhub_orphan") {
      query["classification"] = `eq.${bucket}`;
    }
  }

  try {
    const { rows, total } = await supaSelect<PlatformGapRow>({
      path: "vw_platform_gaps",
      query,
      prefer: "count=exact",
    });

    // Build top-line summary by re-counting on the unfiltered set.
    // Cheap to do with a separate select since the view is small.
    const summary = await supaSelect<PlatformGapRow>({
      path: "vw_platform_gaps",
      query: {
        select: "missing_close,missing_airtable,missing_mighty,missing_intercom,missing_vendhub,classification",
        limit: 10000,
      },
    });
    const all = summary.rows;
    const buckets = {
      total: all.length,
      fully_onboarded: all.filter((r) => r.classification === "fully_onboarded").length,
      airtable_orphan: all.filter((r) => r.classification === "airtable_orphan").length,
      intercom_orphan: all.filter((r) => r.classification === "intercom_orphan").length,
      mighty_orphan: all.filter((r) => r.classification === "mighty_orphan").length,
      vendhub_orphan: all.filter((r) => r.classification === "vendhub_orphan").length,
      close_only_or_partial: all.filter((r) => r.classification === "close_only_or_partial").length,
      missing_close: all.filter((r) => r.missing_close).length,
      missing_airtable: all.filter((r) => r.missing_airtable).length,
      missing_mighty: all.filter((r) => r.missing_mighty).length,
      missing_intercom: all.filter((r) => r.missing_intercom).length,
      missing_vendhub: all.filter((r) => r.missing_vendhub).length,
    };

    return NextResponse.json({
      rows,
      total: total ?? rows.length,
      buckets,
      bucket,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
