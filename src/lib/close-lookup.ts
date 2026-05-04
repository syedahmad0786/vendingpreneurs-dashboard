/**
 * Close CRM lookup helpers.
 *
 * Used to resolve a Close lead_xxx id from an email when the dashboard
 * doesn't already know it (for example: a Resubmit clicked from the New
 * Errors view on a row whose Onboarding Errors table entry has no Lead ID
 * populated). After a successful lookup we also backfill the discovered
 * id onto the matching Clients / Student Onboarding rows so future
 * operations don't have to repeat the lookup.
 */

const CLOSE_API_KEY = process.env.CLOSE_API_KEY || "";
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID || "";

const CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
const STUDENT_TABLE = "tblMLFYTeoqrtmgXQ";

function basicAuth(): string {
  // Close uses HTTP Basic with the api key as username, no password.
  const token = Buffer.from(`${CLOSE_API_KEY}:`).toString("base64");
  return `Basic ${token}`;
}

export interface CloseLeadHit {
  id: string;
  display_name?: string;
}

/**
 * One-shot lookup against Close CRM by email. Returns the first matching
 * lead or null if nothing found. Retries with exponential backoff on
 * 429 (rate limited).
 */
export async function lookupCloseLeadByEmail(
  email: string,
  attempt = 0
): Promise<CloseLeadHit | null> {
  if (!CLOSE_API_KEY) {
    throw new Error("CLOSE_API_KEY not configured");
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  const url =
    `https://api.close.com/api/v1/lead/?query=${encodeURIComponent("email_address:" + cleanEmail)}` +
    `&_fields=id,display_name&_limit=1`;

  const res = await fetch(url, {
    headers: { Authorization: basicAuth(), Accept: "application/json" },
    cache: "no-store",
  });

  if (res.status === 429 && attempt < 4) {
    const retryAfter =
      Number(res.headers.get("retry-after") || 0) * 1000 ||
      5000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, retryAfter));
    return lookupCloseLeadByEmail(email, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(
      `Close ${res.status}: ${(await res.text()).slice(0, 200)}`
    );
  }

  const json = (await res.json()) as {
    data?: CloseLeadHit[];
    total_results?: number;
  };
  if (Array.isArray(json.data) && json.data.length > 0) return json.data[0];
  return null;
}

interface BackfillResult {
  clientsUpdated: number;
  studentsUpdated: number;
  failures: { table: string; status: number; body?: string }[];
}

/**
 * Write the discovered Close lead id back to every Clients + Student
 * Onboarding row that matches the email. Best-effort: per-table failures
 * are reported but don't throw, so the caller can still proceed with
 * whatever it was doing (e.g. firing the n8n retry webhook).
 */
export async function backfillCloseLeadId(
  email: string,
  closeLeadId: string
): Promise<BackfillResult> {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE) {
    return { clientsUpdated: 0, studentsUpdated: 0, failures: [] };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { clientsUpdated: 0, studentsUpdated: 0, failures: [] };
  }

  const failures: BackfillResult["failures"] = [];

  const findIds = async (
    tableId: string,
    emailFields: string[]
  ): Promise<string[]> => {
    const formula = `OR(${emailFields
      .map((f) => `LOWER({${f}})='${cleanEmail.replace(/'/g, "\\'")}'`)
      .join(",")})`;
    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}` +
      `?filterByFormula=${encodeURIComponent(formula)}` +
      `&fields[]=Close Lead ID&maxRecords=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      cache: "no-store",
    });
    if (!res.ok) {
      failures.push({
        table: tableId,
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return [];
    }
    const j = (await res.json()) as {
      records?: { id: string; fields: Record<string, unknown> }[];
    };
    return (j.records || []).map((r) => r.id);
  };

  const patch = async (
    tableId: string,
    ids: string[]
  ): Promise<number> => {
    if (ids.length === 0) return 0;
    const records = ids.map((id) => ({
      id,
      fields: { "Close Lead ID": closeLeadId },
    }));
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
      failures.push({
        table: tableId,
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return 0;
    }
    return ids.length;
  };

  const [clientIds, studentIds] = await Promise.all([
    findIds(CLIENTS_TABLE, ["Personal Email", "Business Email", "Email", "Best Email"]),
    findIds(STUDENT_TABLE, ["Best Email", "Email"]),
  ]);
  const [clientsUpdated, studentsUpdated] = await Promise.all([
    patch(CLIENTS_TABLE, clientIds),
    patch(STUDENT_TABLE, studentIds),
  ]);

  return { clientsUpdated, studentsUpdated, failures };
}

/**
 * Combined lookup + backfill. Used by the dashboard's resubmit endpoint
 * when a retry needs a Close lead id but none was supplied. Returns the
 * discovered id (or null) plus the backfill outcome so the caller can
 * decide whether to proceed or surface "still missing" to the UI.
 */
export async function resolveCloseLeadId(email: string): Promise<{
  closeLeadId: string | null;
  backfill: BackfillResult | null;
  source: "lookup" | "not-found" | "error";
  errorMessage?: string;
}> {
  let hit: CloseLeadHit | null = null;
  try {
    hit = await lookupCloseLeadByEmail(email);
  } catch (err) {
    return {
      closeLeadId: null,
      backfill: null,
      source: "error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    };
  }
  if (!hit) {
    return { closeLeadId: null, backfill: null, source: "not-found" };
  }
  const backfill = await backfillCloseLeadId(email, hit.id);
  return { closeLeadId: hit.id, backfill, source: "lookup" };
}
