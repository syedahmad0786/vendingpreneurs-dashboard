/**
 * POST /api/verify/close
 *
 * Backfill Close Lead IDs onto Clients + Student Onboarding rows.
 *
 * For every row's email, calls
 *   GET https://api.close.com/api/v1/lead/?query=email_address:<email>&_fields=id
 * and writes back to BOTH Clients (tblwDucKYAsPDVBA2) and Student Onboarding
 * (tblMLFYTeoqrtmgXQ):
 *   Close Lead ID: lead_xxx (or blank if not found)
 *
 * Body: { force?: boolean, max?: number, email?: string }
 *   - email:  verify only this single email
 *   - force:  re-verify even rows that already have Close Lead ID
 *   - max:    cap how many rows to process this run
 *
 * Auth: x-cron-secret header.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 300;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const CLOSE_API_KEY = process.env.CLOSE_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
const STUDENT_TABLE = "tblMLFYTeoqrtmgXQ";

function authOk(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

function basicAuth(): string {
  // Close uses HTTP Basic with the api key as username, no password.
  const token = Buffer.from(`${CLOSE_API_KEY}:`).toString("base64");
  return `Basic ${token}`;
}

interface CloseLeadHit {
  id: string;
  display_name?: string;
}

async function lookupCloseLead(email: string, attempt = 0): Promise<CloseLeadHit | null> {
  const url = `https://api.close.com/api/v1/lead/?query=${encodeURIComponent("email_address:" + email)}&_fields=id,display_name&_limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(), Accept: "application/json" },
    cache: "no-store",
  });
  // Close's documented rate limit: ~40 req/sec per org; back off on 429.
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after") || 0) * 1000 || 5000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, retryAfter));
    return lookupCloseLead(email, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Close ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: CloseLeadHit[]; total_results?: number };
  if (Array.isArray(json.data) && json.data.length > 0) return json.data[0];
  return null;
}

async function patchAirtableBatch(
  tableId: string,
  records: { id: string; fields: Record<string, unknown> }[]
): Promise<{ ok: boolean; status: number; body?: string }> {
  if (records.length === 0) return { ok: true, status: 200 };
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ records, typecast: true }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: body.slice(0, 300) };
  }
  return { ok: true, status: res.status };
}

function pickEmail(f: Record<string, unknown>): string {
  const email =
    (f["Personal Email"] as string) ||
    (f["Business Email"] as string) ||
    (f["Email"] as string) ||
    (f["Best Email"] as string) ||
    "";
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  if (!CLOSE_API_KEY) {
    return NextResponse.json(
      { error: "CLOSE_API_KEY not configured" },
      { status: 503 }
    );
  }
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { force?: boolean; max?: number; email?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }

  const started = Date.now();
  const force = Boolean(body.force);
  const max = body.max ?? Infinity;
  const singleEmail = body.email?.trim().toLowerCase();

  const [clientsRows, studentRows] = await Promise.all([
    fetchTable("clients", {
      // Pull the Active Client formula + Date Added so we can skip inactive
      // clients — most of the never-matched-in-Close emails were cancelled or
      // expired customers that aren't worth re-checking.
      fields: [
        "Personal Email", "Business Email", "Close Lead ID",
        "⚙️ Active Client?", "Account Status", "Date Added",
      ],
      cacheTtl: 0,
    }),
    fetchTable("studentOnboarding", {
      fields: ["Best Email", "Close Lead ID"],
      cacheTtl: 0,
    }).catch(() => []),
  ]);

  // Match the dashboard's active-only filter: Active = Yes OR Account Status
  // = Active OR Account Status = Waiting OR row added in last 3 days.
  // Inactive/cancelled rows are skipped entirely.
  const isActive = (f: Record<string, unknown>): boolean => {
    const acct = ((f["Account Status"] as string) || "").toLowerCase();
    if (acct === "active" || acct === "waiting") return true;
    if (acct === "cancelled") return false;
    const ac = ((f["⚙️ Active Client?"] as string) || "").toLowerCase();
    if (ac === "yes") return true;
    const dateAdded = (f["Date Added"] as string) || "";
    if (dateAdded) {
      const ageHours = (Date.now() - new Date(dateAdded).getTime()) / 36e5;
      if (ageHours < 72) return true; // 3-day grace for fresh rows
    }
    return false;
  };

  const byEmail = new Map<string, { table: "clients" | "students"; recordId: string; needsCheck: boolean }[]>();
  let skippedInactive = 0;
  for (const r of clientsRows) {
    const f = r.fields as Record<string, unknown>;
    if (!isActive(f)) {
      skippedInactive++;
      continue;
    }
    const email = pickEmail(f);
    if (!email) continue;
    const existing = ((f["Close Lead ID"] as string) || "").trim();
    const needsCheck = force || !existing;
    const arr = byEmail.get(email) || [];
    arr.push({ table: "clients", recordId: r.id, needsCheck });
    byEmail.set(email, arr);
  }
  // Student Onboarding rows: only include if they share an email with an
  // active Clients row (so we don't re-process emails for inactive clients).
  for (const r of studentRows) {
    const email = ((r.fields["Best Email"] as string) || "").trim().toLowerCase();
    if (!email || !byEmail.has(email)) continue;
    const existing = ((r.fields["Close Lead ID"] as string) || "").trim();
    const needsCheck = force || !existing;
    const arr = byEmail.get(email) || [];
    arr.push({ table: "students", recordId: r.id, needsCheck });
    byEmail.set(email, arr);
  }

  let emailsToCheck: string[];
  if (singleEmail) {
    emailsToCheck = byEmail.has(singleEmail) ? [singleEmail] : [];
  } else {
    emailsToCheck = Array.from(byEmail.entries())
      .filter(([, refs]) => refs.some((r) => r.needsCheck))
      .map(([email]) => email)
      .slice(0, max);
  }

  const clientsPatches: { id: string; fields: Record<string, unknown> }[] = [];
  const studentPatches: { id: string; fields: Record<string, unknown> }[] = [];
  let foundCount = 0;
  let missingCount = 0;
  let errorCount = 0;
  const errorSamples: string[] = [];

  for (const email of emailsToCheck) {
    let hit: CloseLeadHit | null = null;
    try {
      hit = await lookupCloseLead(email);
    } catch (err) {
      errorCount++;
      if (errorSamples.length < 5) {
        errorSamples.push(`${email}: ${err instanceof Error ? err.message : "unknown"}`);
      }
      continue;
    }
    const refs = byEmail.get(email) || [];
    // We always write — even when empty — so a previously-stale id can be
    // cleared. Use empty string when not found so the cell visibly has nothing.
    const closeLeadId = hit?.id || "";
    const fields = { "Close Lead ID": closeLeadId };
    for (const ref of refs) {
      if (ref.table === "clients") clientsPatches.push({ id: ref.recordId, fields });
      else studentPatches.push({ id: ref.recordId, fields });
    }
    if (hit) foundCount++;
    else missingCount++;

    // Close limit ~40 req/sec per org. 50ms = 20/sec — comfortable.
    await new Promise((r) => setTimeout(r, 50));
    if (Date.now() - started > 55_000) break;
  }

  const flushBatches = async (tableId: string, all: { id: string; fields: Record<string, unknown> }[]) => {
    const failures: { status: number; body?: string }[] = [];
    for (let i = 0; i < all.length; i += 10) {
      const chunk = all.slice(i, i + 10);
      const res = await patchAirtableBatch(tableId, chunk);
      if (!res.ok) failures.push(res);
      await new Promise((r) => setTimeout(r, 150));
    }
    return failures;
  };
  const cFails = await flushBatches(CLIENTS_TABLE, clientsPatches);
  const sFails = await flushBatches(STUDENT_TABLE, studentPatches);

  invalidateTableCache("clients");
  invalidateTableCache("studentOnboarding");

  return NextResponse.json({
    success: true,
    checked: emailsToCheck.length,
    foundInClose: foundCount,
    notInClose: missingCount,
    apiErrors: errorCount,
    apiErrorSamples: errorSamples,
    clientsUpdated: clientsPatches.length - cFails.length * 10,
    studentsUpdated: studentPatches.length - sFails.length * 10,
    clientsBatchFailures: cFails,
    studentsBatchFailures: sFails,
    durationMs: Date.now() - started,
  });
}

export const GET = POST;
