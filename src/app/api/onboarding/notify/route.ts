/**
 * POST /api/onboarding/notify
 *
 * Real-time notification endpoint. Any external system (n8n, an admin
 * action, a Clerk webhook handler) can POST here to invalidate the
 * dashboard's in-memory caches. The next dashboard poll will fetch
 * fresh Airtable data — making changes appear within ~10s instead of
 * waiting up to a full poll cycle.
 *
 * Body (all fields optional, all are just hints for the response):
 *   {
 *     reason?: "error_logged" | "error_resolved" | "client_added" | "verify_complete" | string,
 *     email?: string,           // if known, also kicks single-lead supabase resync
 *     leadId?: string,          // close lead_xxx, optional
 *     errorRecordId?: string,   // recXXX from Onboarding Errors table
 *     source?: string,          // e.g. "n8n:ma-resubmit-close" — purely for logs
 *   }
 *
 * No auth required — this endpoint only invalidates caches; it doesn't
 * mutate Airtable or expose data. Even if abused, the worst outcome is
 * the cache stays cold and Airtable gets re-fetched. Rate limiting at
 * the edge handles the rest.
 */

import { NextRequest, NextResponse } from "next/server";
import { invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  let body: {
    reason?: string;
    email?: string;
    leadId?: string;
    errorRecordId?: string;
    source?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  // Bust every cache the dashboard depends on. Cheap — just deletes
  // in-memory map entries.
  invalidateTableCache("clients");
  invalidateTableCache("studentOnboarding");
  invalidateTableCache("onboardingErrors");

  // If we know the email, fire-and-forget a single-lead Supabase resync
  // so platform_presence reflects the change for that lead within ~1s.
  // (Not awaited — we want this endpoint to return immediately so n8n
  // workflows aren't slowed down.)
  if (body.email) {
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/supabase/sync-lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: body.email }),
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    invalidated: ["clients", "studentOnboarding", "onboardingErrors"],
    reason: body.reason || "unspecified",
    source: body.source || null,
    email: body.email || null,
    receivedAt: new Date().toISOString(),
  });
}

// GET shows the endpoint is alive — useful for first-time webhook
// configuration checks.
export async function GET() {
  return NextResponse.json({
    ok: true,
    handler: "onboarding/notify",
    description: "POST here to invalidate dashboard caches in real time",
  });
}
