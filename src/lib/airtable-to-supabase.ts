/**
 * Airtable → Supabase syncer (shared module).
 *
 * Used by /api/supabase/sync (full table) and /api/supabase/sync-lead (one row).
 * Mirrors scripts/supabase/sync_airtable.py — bulk upsert into leads +
 * platform_presence so the PostgREST bulk endpoint's "all keys must match"
 * rule is satisfied.
 */

import type { AirtableRecord } from "./airtable";

const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function truthy(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return !["0", "no", "false", "n", "not sent"].includes(s);
  }
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

type PresenceRow = {
  lead_id: string;
  platform: "close" | "airtable" | "mighty" | "intercom" | "vendhub";
  status: "member" | "invited" | "failed" | "missing" | "unknown";
  external_id: string | null;
  joined_at: string | null;
  invited_at: string | null;
  failed_at: string | null;
};

type LeadRow = {
  email: string;
  full_name: string | null;
  program_tier: string | null;
  sales_rep: string | null;
  close_lead_id: string | null;
  airtable_id: string | null;
  mn_invite_id: string | null;
  /** Real MN member id from the MN Admin API verifier. */
  mn_member_id: string | null;
  /** Real Intercom contact id from the Intercom verifier. */
  intercom_contact_id: string | null;
  vendhub_user_id: string | null;
  vendhub_org: string | null;
};

export interface SyncResult {
  fetched: number;
  leadsUpserted: number;
  presencesUpserted: number;
  skippedNoEmail: number;
  durationMs: number;
}

/** Build the list of (lead, presence[]) pairs from a batch of Airtable records. */
function buildRowsFromAirtable(records: AirtableRecord[]): {
  leads: Map<string, LeadRow & { _raw: Record<string, unknown>; _airtable_id: string }>;
  skippedNoEmail: number;
} {
  const byEmail = new Map<string, LeadRow & { _raw: Record<string, unknown>; _airtable_id: string }>();
  let skipped = 0;
  for (const r of records) {
    const f = r.fields as Record<string, unknown>;
    // Coalesce email across the four columns the Clients table uses.
    // Falls back to "Best Email" for any leftover Student Onboarding rows.
    const email = ((
      (f["Personal Email"] as string) ||
      (f["Email"] as string) ||
      (f["Business Email"] as string) ||
      (f["vendhub_email"] as string) ||
      (f["Best Email"] as string) ||
      ""
    ) || "").trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }
    const cidRaw = (f["Client ID"] ?? f["Client ID*"]);
    const cidStr = cidRaw !== undefined && cidRaw !== null ? String(cidRaw) : "";
    const row = {
      email,
      full_name: (f["Full Name"] as string) || null,
      program_tier:
        (f["Program Tier Purchased"] as string) ||
        (f["Membership Level (Text)"] as string) ||
        (f["Membership Level"] as string) ||
        null,
      sales_rep: (f["Sales Rep"] as string) || null,
      // Only the legacy Student Onboarding shape carries Close lead_* ids.
      // The Clients table now also has a dedicated Close Lead ID column.
      close_lead_id:
        ((f["Close Lead ID"] as string) || "").trim() ||
        (cidStr.startsWith("lead_") ? cidStr : null),
      airtable_id: r.id,
      mn_invite_id: f["MN Invite ID"] ? String(f["MN Invite ID"]) : null,
      mn_member_id: f["MN Member ID"] ? String(f["MN Member ID"]) : null,
      intercom_contact_id: (f["Intercom Contact ID"] as string) || null,
      vendhub_user_id: (f["VendHub User ID"] as string) || null,
      vendhub_org: (f["VendHub Organization"] as string) || null,
      _raw: f,
      _airtable_id: r.id,
    };
    const existing = byEmail.get(email);
    if (!existing || (row.close_lead_id && !existing.close_lead_id)) {
      byEmail.set(email, row);
    } else {
      existing._raw = { ...existing._raw, ...f };
      existing._airtable_id = r.id;
    }
  }
  return { leads: byEmail, skippedNoEmail: skipped };
}

function presenceRowsFor(
  leadId: string,
  f: Record<string, unknown>,
  airtableId: string
): PresenceRow[] {
  const out: PresenceRow[] = [];
  const make = (
    platform: PresenceRow["platform"],
    status: PresenceRow["status"],
    extras: Partial<PresenceRow> = {}
  ): PresenceRow => ({
    lead_id: leadId,
    platform,
    status,
    external_id: extras.external_id ?? null,
    joined_at: extras.joined_at ?? null,
    invited_at: extras.invited_at ?? null,
    failed_at: extras.failed_at ?? null,
  });

  // Airtable presence — the row exists, so they're tracked.
  out.push(
    make("airtable", truthy(f["Archived"]) ? "missing" : "member", {
      external_id: airtableId,
      joined_at: (f["Date Added"] as string) || (f["Create Date"] as string) || null,
    })
  );

  // Close — populate when the legacy lead_* prefix is present, otherwise
  // treat membership as implied by being a paying client (the Clients
  // table only contains closed deals).
  const cid = (f["Client ID"] as string) || "";
  const hubspotDealId = (f["Hubspot Deal ID"] as number | undefined) || 0;
  if (cid.startsWith("lead_")) {
    out.push(make("close", "member", { external_id: cid }));
  } else if (hubspotDealId && Number(hubspotDealId) > 0) {
    out.push(make("close", "member", { external_id: `hs_${hubspotDealId}` }));
  } else {
    out.push(make("close", "member", { external_id: airtableId }));
  }

  // Mighty Networks — real source of truth is On Mighty Networks/MN Member ID
  // populated by /api/verify/mighty-networks. Skool is a separate platform
  // and is NOT used as a proxy.
  const onMN = ((f["On Mighty Networks"] as string) || "").toLowerCase();
  const mnMemberId = f["MN Member ID"] ? String(f["MN Member ID"]) : null;
  const mnJoinDate = (f["MN Join Date"] as string) || null;
  const mnVerifiedLegacy = ((f["MN Verified"] as string) || "").toLowerCase();
  let mnStatus: PresenceRow["status"] | null = null;
  if (onMN === "verified" || onMN === "yes" || mnMemberId) {
    mnStatus = "member";
  } else if (["member", "joined", "active"].includes(mnVerifiedLegacy)) {
    mnStatus = "member";
  } else if (onMN === "waiting" || truthy(f["MN Invite Granted"]) || truthy(f["MN Invite ID"])) {
    mnStatus = "invited";
  } else if (onMN === "not imported" || onMN === "no") {
    mnStatus = "missing";
  }
  if (mnStatus) {
    out.push(
      make("mighty", mnStatus, {
        // Real MN member id from API takes priority over the invite id.
        external_id: mnMemberId || (f["MN Invite ID"] ? String(f["MN Invite ID"]) : null),
        joined_at: mnJoinDate,
      })
    );
  }

  // Intercom — real source of truth is Intercom Synced + Intercom Contact ID
  // populated by /api/verify/intercom.
  const icSynced = ((f["Intercom Synced"] as string) || "").toLowerCase();
  const icContactId = (f["Intercom Contact ID"] as string) || null;
  const icVerifiedAt = (f["Intercom Verified At"] as string) || null;
  const icVerifiedLegacy = (f["Intercom Verified"] as string) || "";
  let icStatus: PresenceRow["status"] | null = null;
  if (icSynced === "verified" || icSynced === "yes" || icContactId) {
    icStatus = "member";
  } else if (icVerifiedLegacy === "Verified") {
    icStatus = "member";
  } else if (icSynced === "waiting") {
    icStatus = "invited";
  } else if (icSynced === "not imported" || icSynced === "no") {
    icStatus = "missing";
  } else if (truthy(f["Intercome Failed?"])) {
    icStatus = "failed";
  }
  if (icStatus) {
    out.push(
      make("intercom", icStatus, {
        external_id: icContactId,
        invited_at: icVerifiedAt,
      })
    );
  }

  // VendHub — Clients table uses On Vendstack / in_vendhub / Has Machine
  // formula instead of the Status enum.
  const vh = ((f["VendHub Status"] as string) || "").toUpperCase();
  const vhMap: Record<string, PresenceRow["status"]> = {
    ACTIVE: "member",
    PENDING: "invited",
    CANCELED: "failed",
    "NOT FOUND": "missing",
  };
  const onVendstack = ((f["On Vendstack"] as string) || "").toLowerCase() === "yes";
  const inVendhubFlag = truthy(f["in_vendhub"]);
  const hasMachine = ((f["Has Machine"] as string) || "").toLowerCase() === "yes";
  const invitedToVH = truthy(f["Invited to VendHUB"]) || truthy(f["invited_to_vendhub"]);
  const machinesPlaced = Number(f["Machines Placed"]) || 0;
  const participation = Number(f["Vendhub Participation"]) || 0;
  const dataSyncLinks = f["VendHub Data Sync"];
  const hasDataSyncLink = Array.isArray(dataSyncLinks) && dataSyncLinks.length > 0;
  if (vhMap[vh]) {
    out.push(make("vendhub", vhMap[vh], { external_id: (f["VendHub User ID"] as string) || null }));
  } else if (
    onVendstack ||
    inVendhubFlag ||
    hasMachine ||
    machinesPlaced > 0 ||
    participation > 0 ||
    hasDataSyncLink
  ) {
    out.push(make("vendhub", "member", { external_id: (f["VendHub User ID"] as string) || null }));
  } else if (invitedToVH) {
    out.push(make("vendhub", "invited", { external_id: null }));
  }
  return out;
}

function isTruthy(v: unknown): boolean {
  return truthy(v);
}

async function supaBulkUpsert(
  table: string,
  onConflict: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${table} ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function supaSelectLeadIds(emails: string[]): Promise<Record<string, string>> {
  if (emails.length === 0) return {};
  // Chunk IN clauses to stay under PostgREST URL length
  const out: Record<string, string> = {};
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const q = `email=in.(${chunk.map((e) => `"${e}"`).join(",")})`;
    const res = await fetch(`${SUPA_URL}/rest/v1/leads?select=id,email&${q}`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase select leads ${res.status}`);
    const rows = (await res.json()) as { id: string; email: string }[];
    for (const r of rows) out[r.email] = r.id;
  }
  return out;
}

export async function syncRecordsToSupabase(
  records: AirtableRecord[]
): Promise<SyncResult> {
  const started = Date.now();
  const { leads, skippedNoEmail } = buildRowsFromAirtable(records);

  // 1. Bulk upsert leads (strip internal _raw fields)
  const leadRows = Array.from(leads.values()).map((r) => {
    const { _raw, _airtable_id, ...clean } = r;
    void _raw;
    void _airtable_id;
    return clean;
  });
  const BATCH = 500;
  for (let i = 0; i < leadRows.length; i += BATCH) {
    await supaBulkUpsert("leads", "email", leadRows.slice(i, i + BATCH));
  }

  // 2. Look up lead ids for emails we just upserted
  const idByEmail = await supaSelectLeadIds(Array.from(leads.keys()));

  // 3. Build presence rows
  const presences: PresenceRow[] = [];
  for (const [email, row] of leads) {
    const leadId = idByEmail[email];
    if (!leadId) continue;
    presences.push(...presenceRowsFor(leadId, row._raw, row._airtable_id));
  }

  // 4. Bulk upsert presences
  for (let i = 0; i < presences.length; i += BATCH) {
    await supaBulkUpsert(
      "platform_presence",
      "lead_id,platform",
      presences.slice(i, i + BATCH) as unknown as Record<string, unknown>[]
    );
  }

  return {
    fetched: records.length,
    leadsUpserted: leadRows.length,
    presencesUpserted: presences.length,
    skippedNoEmail,
    durationMs: Date.now() - started,
  };
}

export function isSyncConfigured(): boolean {
  return Boolean(SUPA_URL && SUPA_KEY);
}
