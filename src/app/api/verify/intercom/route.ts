/**
 * POST /api/verify/intercom
 *
 * Verify each Clients row against the live Intercom Contacts API.
 * For every email, calls
 *   POST https://api.intercom.io/contacts/search
 * with { query: { field: email, operator: =, value: <email> } } and
 * writes back to BOTH Clients (tblwDucKYAsPDVBA2) and Student
 * Onboarding (tblMLFYTeoqrtmgXQ):
 *   Intercom Synced:        "Verified" | "Not imported"
 *   Intercom Contact ID:    <contact.id>
 *   Intercom Verified At:   <ISO now>
 *
 * Body: { force?: boolean, max?: number, email?: string }
 *   - email: verify only this single email
 *   - force: re-verify even rows that already have Intercom Synced set
 *   - max:   cap how many rows to process this run
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTable, invalidateTableCache } from "@/lib/airtable";

export const maxDuration = 300;

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";
const IC_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

const CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
const STUDENT_TABLE = "tblMLFYTeoqrtmgXQ";

function authOk(req: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return true;
  if (req.headers.get("x-vercel-cron")) return true;
  return false;
}

interface IcContact {
  type: "contact";
  id: string;
  email: string;
  external_id?: string;
  name?: string;
}
interface IcSearchResp {
  type: "list";
  data?: IcContact[];
  total_count?: number;
}

async function searchIntercom(email: string, attempt = 0): Promise<IcContact | null> {
  const res = await fetch("https://api.intercom.io/contacts/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${IC_TOKEN}`,
      "Intercom-Version": "2.10",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: { field: "email", operator: "=", value: email },
    }),
    cache: "no-store",
  });
  // Intercom rate limit: 1000 req/min by default. Back off on 429.
  if (res.status === 429 && attempt < 4) {
    const waitMs = 5000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, waitMs));
    return searchIntercom(email, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Intercom ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as IcSearchResp;
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
  if (!IC_TOKEN) {
    return NextResponse.json(
      { error: "INTERCOM_ACCESS_TOKEN not configured" },
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
      fields: [
        "Personal Email",
        "Business Email",
        "Intercom Synced",
        "Intercom Contact ID",
        "Intercom Verified At",
      ],
      cacheTtl: 0,
    }),
    fetchTable("studentOnboarding", {
      fields: ["Best Email", "Intercom Synced", "Intercom Contact ID"],
      cacheTtl: 0,
    }).catch(() => []),
  ]);

  const byEmail = new Map<string, { table: "clients" | "students"; recordId: string; needsCheck: boolean }[]>();
  for (const r of clientsRows) {
    const email = pickEmail(r.fields as Record<string, unknown>);
    if (!email) continue;
    const synced = ((r.fields["Intercom Synced"] as string) || "").toLowerCase();
    const needsCheck = force || !synced;
    const arr = byEmail.get(email) || [];
    arr.push({ table: "clients", recordId: r.id, needsCheck });
    byEmail.set(email, arr);
  }
  for (const r of studentRows) {
    const email = ((r.fields["Best Email"] as string) || "").trim().toLowerCase();
    if (!email) continue;
    const synced = ((r.fields["Intercom Synced"] as string) || "").toLowerCase();
    const needsCheck = force || !synced;
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
    let contact: IcContact | null = null;
    try {
      contact = await searchIntercom(email);
    } catch (err) {
      errorCount++;
      if (errorSamples.length < 5) {
        errorSamples.push(`${email}: ${err instanceof Error ? err.message : "unknown"}`);
      }
      continue;
    }
    const refs = byEmail.get(email) || [];
    const fields = contact
      ? {
          "Intercom Synced": "Verified",
          "Intercom Contact ID": contact.id,
          "Intercom Verified At": new Date().toISOString(),
        }
      : {
          "Intercom Synced": "Not imported",
          "Intercom Verified At": new Date().toISOString(),
        };
    for (const ref of refs) {
      // Student Onboarding doesn't always have Intercom Verified At —
      // strip that field for the student patch to avoid 422s.
      if (ref.table === "clients") {
        clientsPatches.push({ id: ref.recordId, fields });
      } else {
        const studentFields: Record<string, unknown> = {
          "Intercom Synced": fields["Intercom Synced"],
        };
        if (contact) studentFields["Intercom Contact ID"] = contact.id;
        studentPatches.push({ id: ref.recordId, fields: studentFields });
      }
    }
    if (contact) foundCount++;
    else missingCount++;

    // Intercom rate limit is generous (1000/min) but stay polite.
    await new Promise((r) => setTimeout(r, 100));
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
    foundOnIntercom: foundCount,
    notOnIntercom: missingCount,
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
