/**
 * POST /api/verify/mighty-networks
 *
 * Verify each Clients row against the live Mighty Networks Admin API.
 * For every email, calls
 *   GET https://api.mn.co/admin/v1/networks/{MN_NETWORK_ID}/members/by_email?email=...
 * and writes back to BOTH Clients (tblwDucKYAsPDVBA2) and Student
 * Onboarding (tblMLFYTeoqrtmgXQ):
 *   On Mighty Networks: "Yes" | "No"
 *   MN Join Date:       <member.created_at>
 *   MN Member ID:       <member.id>
 *
 * Body: { force?: boolean, max?: number, email?: string }
 *   - email: verify only this single email (ignores other args)
 *   - force: re-verify even rows that already have On Mighty Networks set
 *   - max: cap how many rows to process this run
 *
 * Auth: same as supabase sync — x-cron-secret or x-vercel-cron header.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 300; // up to 5 min

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const MN_API_KEY = process.env.MN_API_KEY || "";
const MN_NETWORK_ID = process.env.MN_NETWORK_ID || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
const STUDENT_TABLE = "tblMLFYTeoqrtmgXQ";

function authOk(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

interface MnMember {
  id: number;
  created_at: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

async function lookupMnMember(email: string, attempt = 0): Promise<MnMember | null> {
  const url = `https://api.mn.co/admin/v1/networks/${MN_NETWORK_ID}/members/by_email?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${MN_API_KEY}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  // MN's documented rate limit is 100 req/min for standard plans.
  // Back off and retry on 429.
  if (res.status === 429 && attempt < 4) {
    const waitMs = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s, 40s
    await new Promise((r) => setTimeout(r, waitMs));
    return lookupMnMember(email, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`MN API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as MnMember;
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
  if (!MN_API_KEY || !MN_NETWORK_ID) {
    return NextResponse.json(
      { error: "MN_API_KEY / MN_NETWORK_ID not configured" },
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

  // 1. Pull both tables. We need email + existing On Mighty Networks
  //    so we can skip already-verified rows unless force=true.
  const [clientsRows, studentRows] = await Promise.all([
    fetchTable("clients", {
      fields: [
        "Personal Email",
        "Business Email",
        "On Mighty Networks",
        "MN Join Date",
        "MN Member ID",
      ],
      cacheTtl: 0,
    }),
    fetchTable("studentOnboarding", {
      fields: ["Best Email", "On Mighty Networks", "MN Join Date", "MN Member ID"],
      cacheTtl: 0,
    }).catch(() => []), // table may have different field names — tolerate
  ]);

  // Build email → [{ table, recordId }]
  const byEmail = new Map<string, { table: "clients" | "students"; recordId: string; needsCheck: boolean }[]>();
  for (const r of clientsRows) {
    const email = pickEmail(r.fields as Record<string, unknown>);
    if (!email) continue;
    const onMN = ((r.fields["On Mighty Networks"] as string) || "").toLowerCase();
    const needsCheck = force || (!onMN);
    const arr = byEmail.get(email) || [];
    arr.push({ table: "clients", recordId: r.id, needsCheck });
    byEmail.set(email, arr);
  }
  for (const r of studentRows) {
    const email = ((r.fields["Best Email"] as string) || "").trim().toLowerCase();
    if (!email) continue;
    const onMN = ((r.fields["On Mighty Networks"] as string) || "").toLowerCase();
    const needsCheck = force || (!onMN);
    const arr = byEmail.get(email) || [];
    arr.push({ table: "students", recordId: r.id, needsCheck });
    byEmail.set(email, arr);
  }

  // 2. Pick the email list to check
  let emailsToCheck: string[];
  if (singleEmail) {
    emailsToCheck = byEmail.has(singleEmail) ? [singleEmail] : [];
  } else {
    emailsToCheck = Array.from(byEmail.entries())
      .filter(([, refs]) => refs.some((r) => r.needsCheck))
      .map(([email]) => email)
      .slice(0, max);
  }

  // 3. Check each email against MN, build per-table patch lists
  const clientsPatches: { id: string; fields: Record<string, unknown> }[] = [];
  const studentPatches: { id: string; fields: Record<string, unknown> }[] = [];
  let foundCount = 0;
  let missingCount = 0;
  let errorCount = 0;
  const errorSamples: string[] = [];

  for (const email of emailsToCheck) {
    let member: MnMember | null = null;
    try {
      member = await lookupMnMember(email);
    } catch (err) {
      errorCount++;
      if (errorSamples.length < 5) errorSamples.push(`${email}: ${err instanceof Error ? err.message : "unknown"}`);
      continue;
    }
    const refs = byEmail.get(email) || [];
    const fields = member
      ? {
          "On Mighty Networks": "Yes",
          "MN Join Date": member.created_at,
          "MN Member ID": String(member.id),
        }
      : { "On Mighty Networks": "No" };
    for (const ref of refs) {
      if (ref.table === "clients") clientsPatches.push({ id: ref.recordId, fields });
      else studentPatches.push({ id: ref.recordId, fields });
    }
    if (member) foundCount++;
    else missingCount++;
    // MN documented rate limit: 100 req/min standard, 300 req/min premium.
    // 700ms per request keeps us comfortably under the standard limit.
    await new Promise((r) => setTimeout(r, 700));

    // Bail before Vercel's function timeout hits, so we always return a
    // valid response and the next cron tick can pick up where we left off.
    if (Date.now() - started > 270_000) {
      break;
    }
  }

  // 4. PATCH both tables in batches of 10
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
    foundOnMN: foundCount,
    notOnMN: missingCount,
    apiErrors: errorCount,
    apiErrorSamples: errorSamples,
    clientsUpdated: clientsPatches.length - cFails.length * 10,
    studentsUpdated: studentPatches.length - sFails.length * 10,
    clientsBatchFailures: cFails,
    studentsBatchFailures: sFails,
    durationMs: Date.now() - started,
  });
}

// GET also works — handy for cron
export const GET = POST;
