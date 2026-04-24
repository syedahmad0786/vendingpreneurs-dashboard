/**
 * Thin Supabase REST client (no SDK to keep cold-start small).
 *
 * Uses PostgREST + the service_role key for server-side reads. Never
 * expose the service_role key to the browser.
 */

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!URL || !KEY) {
  // Don't crash at import — the dashboard can still run without Supabase
  // until the env vars are set. Routes that use these helpers will surface
  // a clear error.
  console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
}

export interface SupabaseRequest {
  /** Path under /rest/v1, e.g. "vw_lead_full" */
  path: string;
  query?: Record<string, string | number>;
  /** PostgREST "Prefer" header — e.g. "count=exact" */
  prefer?: string;
}

export async function supaSelect<T = unknown>(req: SupabaseRequest): Promise<{ rows: T[]; total?: number }> {
  if (!URL || !KEY) throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) params.set(k, String(v));
  const headers: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
  if (req.prefer) headers["Prefer"] = req.prefer;
  const res = await fetch(`${URL}/rest/v1/${req.path}?${params}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${req.path} ${res.status}: ${body.slice(0, 200)}`);
  }
  const totalHeader = res.headers.get("content-range");
  const total = totalHeader ? Number(totalHeader.split("/").pop()) : undefined;
  const rows = (await res.json()) as T[];
  return { rows, total };
}

export async function supaRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!URL || !KEY) throw new Error("Supabase not configured");
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase rpc ${fn} ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface LeadFullRow {
  id: string;
  email: string;
  full_name: string | null;
  program_tier: string | null;
  sales_rep: string | null;
  close_lead_id: string | null;
  airtable_id: string | null;
  mn_invite_id: string | null;
  mn_member_id: string | null;
  intercom_id: string | null;
  vendhub_user_id: string | null;
  vendhub_org: string | null;
  created_at: string;
  updated_at: string;
  close_status: string;
  airtable_status: string;
  mighty_status: string;
  intercom_status: string;
  vendhub_status: string;
  in_close: boolean;
  in_airtable: boolean;
  in_mighty: boolean;
  in_intercom: boolean;
  in_vendhub: boolean;
}

export interface PlatformGapRow {
  id: string;
  email: string;
  full_name: string | null;
  close_lead_id: string | null;
  missing_close: boolean;
  missing_airtable: boolean;
  missing_mighty: boolean;
  missing_intercom: boolean;
  missing_vendhub: boolean;
  classification: string;
}

export const isSupabaseConfigured = () => Boolean(URL && KEY);
