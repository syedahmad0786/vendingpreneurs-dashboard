/**
 * POST /api/webhooks/clerk-vendhub
 *
 * READ-ONLY ingestion of VendHub Clerk events. We NEVER write to Clerk or
 * VendHub from here — every event we receive results in a PATCH to the
 * Airtable Clients + Student Onboarding tables (and a Supabase nudge).
 *
 * Subscribed events (configure in Clerk Dashboard → Webhooks):
 *   user.created            → row added to VendHub
 *   user.updated            → email verification or profile changes
 *   session.created         → first sign-in = activation moment
 *   email.created           → email verification flow
 *   organizationInvitation.created   → invite sent (B2B)
 *   organizationInvitation.accepted  → invite accepted (= activation)
 *   organizationMembership.created   → joined an org
 *
 * Auth: Svix-signature header verified with CLERK_VENDHUB_WEBHOOK_SECRET.
 * The secret is the value Clerk shows AFTER you save the endpoint
 * (starts with `whsec_`).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 30;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const WEBHOOK_SECRET = process.env.CLERK_VENDHUB_WEBHOOK_SECRET || "";

const CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
const STUDENT_TABLE = "tblMLFYTeoqrtmgXQ";

/* ─────────── Svix signature verification ─────────── */

function verifySvixSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): boolean {
  // Clerk webhooks use Svix. Secret format: "whsec_<base64>".
  if (!secret.startsWith("whsec_")) return false;
  const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // Header format: "v1,<sig> v1,<sig>" — Svix can rotate keys, so multiple sigs.
  for (const sig of svixSignature.split(" ")) {
    const [version, value] = sig.split(",");
    if (version !== "v1" || !value) continue;
    if (constantTimeEqual(value, expected)) return true;
  }
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/* ─────────── Airtable helpers ─────────── */

interface ClientRow { id: string; fields: Record<string, unknown> }

async function findRowsByEmail(tableId: string, emailField: string, email: string): Promise<ClientRow[]> {
  // Use one of the email fields per table
  const e = email.toLowerCase().trim();
  const formula =
    tableId === CLIENTS_TABLE
      ? `OR(LOWER({Personal Email})='${e}',LOWER({Business Email})='${e}',LOWER({Email})='${e}',LOWER({vendhub_email})='${e}')`
      : `LOWER({${emailField}})='${e}'`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=10&fields%5B%5D=Personal+Email`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json() as { records?: ClientRow[] };
  return json.records || [];
}

async function patchRow(tableId: string, recordId: string, fields: Record<string, unknown>): Promise<boolean> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, "content-type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return res.ok;
}

async function applyToBothTables(email: string, fields: Record<string, unknown>): Promise<{ clients: number; students: number }> {
  if (!email) return { clients: 0, students: 0 };
  const [clientsRows, studentRows] = await Promise.all([
    findRowsByEmail(CLIENTS_TABLE, "Personal Email", email),
    findRowsByEmail(STUDENT_TABLE, "Best Email", email),
  ]);
  let cOk = 0, sOk = 0;
  for (const r of clientsRows) {
    if (await patchRow(CLIENTS_TABLE, r.id, fields)) cOk++;
  }
  for (const r of studentRows) {
    if (await patchRow(STUDENT_TABLE, r.id, fields)) sOk++;
  }
  return { clients: cOk, students: sOk };
}

/* ─────────── Event helpers ─────────── */

function pickPrimaryEmail(user: Record<string, unknown>): string {
  const emails = user.email_addresses as { id: string; email_address: string; verification?: { status?: string } }[] | undefined;
  if (!emails || emails.length === 0) return "";
  const primaryId = (user.primary_email_address_id as string) || "";
  const primary = emails.find((e) => e.id === primaryId);
  return (primary?.email_address || emails[0]?.email_address || "").toLowerCase().trim();
}

function isoFromEpochMs(ms?: number): string | undefined {
  if (!ms || typeof ms !== "number") return undefined;
  return new Date(ms).toISOString();
}

/* ─────────── Route handler ─────────── */

export async function POST(req: NextRequest) {
  const svixId = req.headers.get("svix-id") || "";
  const svixTimestamp = req.headers.get("svix-timestamp") || "";
  const svixSignature = req.headers.get("svix-signature") || "";

  // Read raw body once — Svix needs the exact bytes for HMAC verification.
  const rawBody = await req.text();

  // Allow setup-mode (no secret yet) by returning a friendly 200 with a
  // hint so first-time webhook config in Clerk can validate the URL.
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        ok: true,
        warning: "CLERK_VENDHUB_WEBHOOK_SECRET not set — events received but not authenticated. Add the whsec_ value from Clerk to Vercel env, then redeploy.",
      },
      { status: 200 }
    );
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Replay protection: reject events older than 5 minutes
  const ts = Number(svixTimestamp);
  if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: "Stale timestamp" }, { status: 400 });
  }

  let payload: { type?: string; data?: Record<string, unknown>; object?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type || "";
  const data = payload.data || {};

  // Route by event type. Each handler:
  //  1. Resolves the relevant Airtable email
  //  2. Builds the field patch (read-only data extracted from the Clerk event)
  //  3. PATCHes both tables
  //  4. Optionally nudges Supabase to resync that single lead
  let summary: { event: string; email?: string; tablesUpdated?: { clients: number; students: number }; skipped?: string };

  switch (eventType) {
    case "user.created":
    case "user.updated": {
      const email = pickPrimaryEmail(data);
      const userId = (data.id as string) || "";
      const emails = data.email_addresses as { email_address: string; verification?: { status?: string } }[] | undefined;
      const emailVerified = emails?.some((e) => e.verification?.status === "verified") ? "Yes" : "No";
      const fields: Record<string, unknown> = {
        "VendHub User ID": userId,
        "VendHub Verified At": new Date().toISOString(),
        "VendHub Email Verified": emailVerified,
      };
      // user.updated with last_sign_in_at populated → also stamp it
      const lastSignIn = isoFromEpochMs(data.last_sign_in_at as number);
      if (lastSignIn) fields["VendHub Last Sign In"] = lastSignIn;
      const tablesUpdated = await applyToBothTables(email, fields);
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    case "session.created": {
      // session.created fires on every sign-in. We treat it as the activation
      // signal — write VendHub Last Sign In so the team sees who's actually
      // using the product.
      const userId = (data.user_id as string) || "";
      // Clerk doesn't include the user object here, just the user_id. We
      // can't resolve email without an extra API call, but we can update
      // any Airtable row whose VendHub User ID matches.
      // Cheaper alternative: skip and let user.updated handle it.
      // For now, just stamp last sign in via VendHub User ID lookup.
      if (!userId) { summary = { event: eventType, skipped: "no user_id" }; break; }
      // Find by VendHub User ID
      const formula = `{VendHub User ID}='${userId.replace(/'/g, "\\'")}'`;
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLIENTS_TABLE}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=5`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }, cache: "no-store" });
      const matches = res.ok ? ((await res.json()) as { records?: ClientRow[] }).records || [] : [];
      let updated = 0;
      const lastSignIn = new Date().toISOString();
      for (const r of matches) {
        if (await patchRow(CLIENTS_TABLE, r.id, { "VendHub Last Sign In": lastSignIn })) updated++;
      }
      summary = { event: eventType, email: userId, tablesUpdated: { clients: updated, students: 0 } };
      break;
    }
    case "email.created": {
      // email.created when a new EmailAddress is added to a Clerk user. Use
      // it as a hint that the user is finishing onboarding.
      const email = ((data.email_address as string) || "").toLowerCase().trim();
      const tablesUpdated = await applyToBothTables(email, {
        "VendHub Email Verified": (data.verification as { status?: string } | undefined)?.status === "verified" ? "Yes" : "No",
      });
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    case "organizationInvitation.created": {
      const email = ((data.email_address as string) || "").toLowerCase().trim();
      const tablesUpdated = await applyToBothTables(email, {
        "VendHub Invite Status": "pending",
        "VendHub Invited At": new Date().toISOString(),
      });
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    case "organizationInvitation.accepted": {
      const email = ((data.email_address as string) || "").toLowerCase().trim();
      const tablesUpdated = await applyToBothTables(email, {
        "VendHub Invite Status": "accepted",
        "VendHub Verified At": new Date().toISOString(),
      });
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    case "organizationInvitation.revoked": {
      const email = ((data.email_address as string) || "").toLowerCase().trim();
      const tablesUpdated = await applyToBothTables(email, { "VendHub Invite Status": "revoked" });
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    case "organizationMembership.created": {
      // The user joined an org — strong activation signal
      const userObj = (data.public_user_data as Record<string, unknown>) || {};
      const email = ((userObj.identifier as string) || "").toLowerCase().trim();
      const userId = ((userObj.user_id as string) || "");
      const tablesUpdated = await applyToBothTables(email, {
        "VendHub User ID": userId,
        "VendHub Verified At": new Date().toISOString(),
        "VendHub Invite Status": "accepted",
      });
      summary = { event: eventType, email, tablesUpdated };
      break;
    }
    default:
      summary = { event: eventType, skipped: "unhandled event type" };
  }

  // Bust caches so the dashboard picks up new state on next poll.
  invalidateTableCache("clients");
  invalidateTableCache("studentOnboarding");

  // Optional: nudge Supabase resync for this one lead so platform_presence
  // reflects the new state within a couple seconds. Fire-and-forget.
  if (summary.email && (summary.tablesUpdated?.clients || 0) > 0) {
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/supabase/sync-lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: summary.email }),
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, ...summary });
}

// GET helps verify deployment + detect missing env without sending events.
export async function GET() {
  return NextResponse.json({
    ok: true,
    handler: "clerk-vendhub",
    secretConfigured: Boolean(WEBHOOK_SECRET),
    expectedHeaders: ["svix-id", "svix-timestamp", "svix-signature"],
    handledEvents: [
      "user.created",
      "user.updated",
      "session.created",
      "email.created",
      "organizationInvitation.created",
      "organizationInvitation.accepted",
      "organizationInvitation.revoked",
      "organizationMembership.created",
    ],
  });
}
