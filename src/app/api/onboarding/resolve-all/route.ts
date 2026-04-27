/**
 * POST /api/onboarding/resolve-all
 *
 * Bulk-marks every open Onboarding Errors record as Resolved. Useful when
 * stale errors from past workflow runs are polluting the Step Health counts.
 *
 * Body:
 *   { olderThanHours?: number, errorType?: string, dryRun?: boolean }
 *
 * Defaults: no time filter, no type filter → resolve everything that is
 * currently New or Investigating.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 60;

interface Body {
  olderThanHours?: number;
  errorType?: string;
  dryRun?: boolean;
}

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const ERROR_TABLE_ID = "tblaQ6fpHGhRs56sH";

function hoursSince(iso?: string): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / 3_600_000;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = await req.json(); } catch {}

  const { olderThanHours, errorType, dryRun } = body;

  try {
    // Read every error row. The table is small so no paging concern.
    const errors = await fetchTable("onboardingErrors", {
      fields: ["Error Type", "Status", "Timestamp", "Resolution Notes"],
      cacheTtl: 0,
    });

    const candidates = errors.filter((r) => {
      const s = (r.fields["Status"] as string) || "";
      if (s !== "New" && s !== "Investigating") return false;
      if (errorType && (r.fields["Error Type"] as string) !== errorType) return false;
      if (olderThanHours !== undefined) {
        const ts = r.fields["Timestamp"] as string | undefined;
        if (hoursSince(ts) < olderThanHours) return false;
      }
      return true;
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        wouldResolve: candidates.length,
        total: errors.length,
      });
    }

    // Airtable PATCH in batches of 10
    let updated = 0;
    const failures: { id: string; error: string }[] = [];
    const nowIso = new Date().toISOString();
    const note = `Bulk-resolved from dashboard at ${nowIso}`;

    for (let i = 0; i < candidates.length; i += 10) {
      const chunk = candidates.slice(i, i + 10);
      const payload = {
        records: chunk.map((r) => ({
          id: r.id,
          fields: {
            Status: "Resolved",
            "Resolution Notes": note,
          },
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
        updated += chunk.length;
      } else {
        const text = await res.text().catch(() => "");
        for (const r of chunk) {
          failures.push({ id: r.id, error: `${res.status}: ${text.slice(0, 120)}` });
        }
      }
      // small delay to respect 5 req/s
      await new Promise((r) => setTimeout(r, 220));
    }

    invalidateTableCache("onboardingErrors");
    invalidateTableCache("clients");

    return NextResponse.json({
      success: true,
      resolved: updated,
      total: errors.length,
      candidates: candidates.length,
      failures,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
