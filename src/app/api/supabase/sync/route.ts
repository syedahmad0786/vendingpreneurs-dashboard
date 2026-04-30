/**
 * POST /api/supabase/sync
 *
 * Full Airtable → Supabase resync. Paginates the Student Onboarding table
 * and bulk-upserts every row into leads + platform_presence.
 *
 * Protected by the CRON_SECRET header (shared secret with n8n) unless we
 * fall back to Vercel's x-vercel-cron identifier.
 *
 * Typical call: n8n cron workflow POSTs every 5 min. Dashboard users can
 * also fire it from the Cross-platform tab "Force resync now" button.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable } from "@/lib/airtable";
import { syncRecordsToSupabase, isSyncConfigured } from "@/lib/airtable-to-supabase";

export const maxDuration = 300; // up to 5 minutes — bulk sync can take ~40s

const CRON_SECRET = process.env.CRON_SECRET || "";

function authOk(req: NextRequest): boolean {
  // Open on dev if no secret is set. On prod we require one of:
  //   - x-cron-secret header matches CRON_SECRET
  //   - x-vercel-cron signed header (for Vercel cron jobs)
  if (!CRON_SECRET) return true;
  const hdr = req.headers.get("x-cron-secret");
  if (hdr && hdr === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isSyncConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)" },
      { status: 503 }
    );
  }
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const records = await fetchTable("clients", {
      fields: [
        // Only fields that actually exist on Clients tblwDucKYAsPDVBA2
        "Full Name", "Personal Email", "Business Email",
        "Client ID*", "Hubspot Deal ID", "Membership Level", "Membership Level (Text)",
        "Sales Rep", "Date Added",
        "Sent Email File", "Welcome Email Sent: ",
        // Mighty Networks (real verifier output)
        "On Mighty Networks", "MN Join Date", "MN Member ID", "MN Invite Granted", "MN Invite ID",
        // Intercom (real verifier output)
        "Intercom Synced", "Intercom Verified At", "Intercom Contact ID",
        // VendHub
        "On Vendstack", "in_vendhub", "Invited to VendHUB", "invited_to_vendhub",
        "Has Machine", "Machines Placed", "Vendhub Participation", "VendHub Data Sync",
        // Close lead deep-link
        "Close Lead ID",
      ],
      cacheTtl: 0,
    });
    const result = await syncRecordsToSupabase(records);
    return NextResponse.json({
      success: true,
      ...result,
      totalMs: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        totalMs: Date.now() - started,
      },
      { status: 500 }
    );
  }
}

// GET also works so you can hit this from a browser for a one-off resync.
// Same auth rules apply.
export const GET = POST;
