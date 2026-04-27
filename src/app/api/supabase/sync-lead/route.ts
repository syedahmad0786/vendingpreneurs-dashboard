/**
 * POST /api/supabase/sync-lead
 *
 * Fire-and-forget single-lead resync. Used by the dashboard right after
 * a retry/resolve action so the Supabase row for that specific lead
 * reflects the new state within a second or two.
 *
 * Body: { airtableId?: string; email?: string }
 *
 * We trust either field. If airtableId is provided, we fetch that row
 * directly. If only email, we filter by Best Email.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, resolveTableId } from "@/lib/airtable";
import { syncRecordsToSupabase, isSyncConfigured } from "@/lib/airtable-to-supabase";

export const maxDuration = 30;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";

export async function POST(req: NextRequest) {
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: { airtableId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const started = Date.now();
  try {
    // Fetch the single Airtable record (direct GET is faster + avoids the
    // list cache issue around sub-second freshness).
    if (body.airtableId) {
      const tblId = resolveTableId("clients");
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tblId}/${body.airtableId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }, cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json({ error: `Airtable ${res.status}` }, { status: 502 });
      }
      const json = await res.json() as { id: string; fields: Record<string, unknown> };
      const result = await syncRecordsToSupabase([json]);
      return NextResponse.json({ success: true, ...result, totalMs: Date.now() - started });
    }

    if (body.email) {
      const safe = body.email.replace(/'/g, "\\'").toLowerCase();
      // Look up across all four email fields the Clients table uses.
      const rows = await fetchTable("clients", {
        filterByFormula:
          `OR(LOWER({Personal Email})='${safe}',LOWER({Business Email})='${safe}',LOWER({Email})='${safe}',LOWER({vendhub_email})='${safe}')`,
        cacheTtl: 0,
      });
      if (rows.length === 0) {
        return NextResponse.json({ success: true, fetched: 0, leadsUpserted: 0, presencesUpserted: 0, skippedNoEmail: 0, durationMs: 0 });
      }
      const result = await syncRecordsToSupabase(rows);
      return NextResponse.json({ success: true, ...result, totalMs: Date.now() - started });
    }

    return NextResponse.json({ error: "Provide airtableId or email" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
