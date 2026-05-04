/**
 * Onboarding Pipeline — derive per-lead per-step status by joining the
 * Student Onboarding table with the Onboarding Errors table.
 *
 * Steps:
 *   1. Close CRM         — lead imported/updated in Close
 *   2. Email Validated   — email address passed validation
 *   3. Mighty Networks   — invitation sent / granted
 *   4. Intercom          — contact created / synced
 *   5. VendHub           — placeholder (details coming later)
 */

import { AirtableRecord, fetchTable } from "./airtable";

export type StepId =
  | "close_crm"
  | "email_validation"
  | "airtable_record"
  | "mighty_networks"
  | "intercom"
  | "vendhub";

export type StepStatus =
  | "success"
  | "error"
  | "pending"
  | "in_progress"
  | "waiting_for_customer"
  | "skipped";

export interface ErrorMeta {
  /** The humanized message we show in UI. */
  message: string;
  /** The raw "Error Type" from Airtable (e.g. "Close CRM Update"). */
  type?: string;
  /** The specific n8n node that threw (e.g. "Retry Close CRM Update"). */
  node?: string;
  /** n8n execution id — useful for jumping straight to the log. */
  executionId?: string;
  /** When the error was logged (ISO). */
  timestamp?: string;
  /** Full raw error payload if stored — rendered as a code block in the drawer. */
  raw?: string;
  /** Did we humanize the message because Airtable had no real text? */
  humanized?: boolean;
}

export interface StepState {
  id: StepId;
  label: string;
  status: StepStatus;
  /** Latest error message if status == "error". Shown inline. */
  errorMessage?: string;
  /** Full error metadata (type, node, execution id, raw). Shown in the drawer. */
  error?: ErrorMeta;
  /** Airtable error record ID (for resubmit). */
  errorRecordId?: string;
  /** Free-form detail, e.g. timestamp, id on downstream system. */
  detail?: string;
  /**
   * True when the step cannot progress until the customer takes an action
   * (clicks the invite, signs up on VendHub, confirms Intercom email).
   * Used to reclassify overall status from "error" to "waiting_for_customer".
   */
  waitingOnCustomer?: boolean;
}

export interface LeadPipeline {
  id: string;                 // Airtable record ID in Student Onboarding
  fullName: string;
  email: string;
  clientId?: string;          // Close CRM lead id (field "Client ID")
  programTier?: string;
  salesRep?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  steps: StepState[];
  /** Highest-priority open issue across all steps. */
  overallStatus: StepStatus;
  /** Index of first non-success step (what they're currently on). */
  currentStepIndex: number;
  /** Platform identifiers for cross-platform deep links. */
  mnInviteId?: string;
  /** Real Mighty Networks member id (from /api/verify/mighty-networks). */
  mnMemberId?: string;
  /** Real Intercom contact id (from /api/verify/intercom). */
  intercomContactId?: string;
  /** Close CRM lead id, e.g. "lead_abc...". */
  closeLeadId?: string;
  vendHubOrganization?: string;
  vendHubUserId?: string;
  /** Airtable record id used for direct Airtable links. */
  airtableRecordId: string;
  /**
   * Active client lifecycle classification. Sourced from the Clients table's
   * `⚙️ Active Client?` formula (Yes/No), with a 3-day grace window for
   * brand-new rows that haven't been classified yet.
   *
   *   "active"      — currently a paying client (Active Client = Yes)
   *   "new_waiting" — added in the last 3 days, formula not yet evaluated
   *                   to Yes; treated as in-flight onboarding
   *   "inactive"    — Active Client = No (cancelled / expired / archived)
   */
  activeStatus: "active" | "new_waiting" | "inactive";
  /**
   * Per-platform customer-wait flags. Used by the dashboard KPI:
   * a lead with both waitingOnMN and waitingOnVendhub = counted once
   * in the top "Waiting for customer" KPI but appears in BOTH sub-breakdowns.
   */
  waitingOnMN?: boolean;
  waitingOnIntercom?: boolean;
  waitingOnVendhub?: boolean;
}

/**
 * Error types (as stored in Airtable) → pipeline step they map to.
 */
const ERROR_TYPE_TO_STEP: Record<string, StepId> = {
  "Close CRM Update": "close_crm",
  "Close CRM Fields Empty": "close_crm",
  "Email Validation": "email_validation",
  // Airtable record creation failures now map to their own step
  "Airtable Client Record": "airtable_record",
  "Airtable Student Record": "airtable_record",
  "Mighty Networks invite": "mighty_networks",
  "Skool Invite": "mighty_networks", // legacy — Skool has been replaced by MN
  "Intercom Contact": "intercom",
};

const STEP_LABELS: Record<StepId, string> = {
  close_crm: "Lead Won in Close CRM",
  email_validation: "Email Validated",
  airtable_record: "Added to Airtable",
  mighty_networks: "Added to Mighty Networks",
  intercom: "Added to Intercom",
  vendhub: "Added to VendHub",
};

/**
 * Default human error copy per step, used when the raw error message is empty
 * or a useless placeholder like "No error message".
 */
const DEFAULT_ERROR_COPY: Record<StepId, string> = {
  close_crm: "CRM setup incomplete — needs manual review",
  email_validation: "Address failed deliverability check",
  airtable_record: "Client or Student Airtable record could not be created",
  mighty_networks: "Plan invite did not send",
  intercom: "Sync attempted — contact could not be created",
  vendhub: "Activation not yet confirmed",
};

function isPlaceholder(s: string): boolean {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  return (
    t === "" ||
    t === "no error" ||
    t === "no error message" ||
    t === "unknown" ||
    t === "no error message."
  );
}

/**
 * Build the rich ErrorMeta object for a step from a raw Airtable error record.
 * Keeps real error messages intact; only falls back to the humanized copy
 * when Airtable truly had no information.
 */
function buildErrorMeta(step: StepId, err: AirtableRecord): ErrorMeta {
  const f = err.fields;
  const raw = typeof f["Error Message"] === "string" ? (f["Error Message"] as string).trim() : "";
  const humanized = isPlaceholder(raw);
  const message = humanized ? DEFAULT_ERROR_COPY[step] : raw;
  return {
    message,
    humanized,
    type: (f["Error Type"] as string) || undefined,
    node: (f["Error Node"] as string) || undefined,
    executionId: (f["Execution ID"] as string) || undefined,
    timestamp: (f["Timestamp"] as string) || undefined,
    raw: (f["Raw Error Data"] as string) || undefined,
  };
}

/** Hours between now and an ISO timestamp. Returns +Infinity if unknown. */
function hoursSince(iso?: string): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return Infinity;
  return (Date.now() - t) / 3_600_000;
}

export const STEP_ORDER: StepId[] = [
  "close_crm",
  "email_validation",
  "airtable_record",
  "mighty_networks",
  "intercom",
  "vendhub",
];

function isTruthy(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "0" || s === "no" || s === "false" || s === "n" || s === "not sent")
      return false;
    return true;
  }
  if (typeof v === "number") return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

/**
 * Look at the lead's fields + related error records and decide what's
 * happening at each step.
 */
export function derivePipeline(
  student: AirtableRecord,
  errorsForLead: AirtableRecord[]
): LeadPipeline {
  const f = student.fields as Record<string, unknown>;

  // Open (unresolved) errors, most recent first.
  // Errors older than 14 days are treated as stale — they don't block the lead
  // and are ignored for Step Health counts (users can bulk-mark them Resolved
  // via "Clear all errors" in the dashboard).
  // Older filter buckets stale errors past 14 days as auto-ignored.
  // We DROPPED that — if a row is explicitly Status="New" or "Investigating"
  // in the Onboarding Errors table it's intentional unfinished work and
  // should always surface on the dashboard, regardless of age. The Errors
  // tab has a Bulk Resolve button for clearing genuine backlog.
  const openErrors = errorsForLead
    .filter((r) => {
      const s = (r.fields["Status"] as string) || "";
      return s === "New" || s === "Investigating";
    })
    .sort((a, b) => {
      const at = new Date((a.fields["Timestamp"] as string) || 0).getTime();
      const bt = new Date((b.fields["Timestamp"] as string) || 0).getTime();
      return bt - at;
    });

  // Group latest open error by step
  const latestErrorByStep: Partial<Record<StepId, AirtableRecord>> = {};
  for (const err of openErrors) {
    const type = (err.fields["Error Type"] as string) || "";
    // When the Error Type doesn't match any known mapping (e.g. "Unknown"),
    // attribute it to close_crm as the catch-all "something went wrong before
    // we got into the pipeline" step. This guarantees every open error row
    // surfaces on the dashboard with an actionable errorRecordId — instead
    // of being silently swallowed because of a typo in Error Type.
    const step = ERROR_TYPE_TO_STEP[type] || "close_crm";
    if (!latestErrorByStep[step]) latestErrorByStep[step] = err;
  }

  // Clients table uses "Date Added" (createdTime field). Older Student
  // Onboarding rows used "Create Date". Read whichever is present.
  const createdAtIso =
    (f["Date Added"] as string | undefined) ||
    (f["Create Date"] as string | undefined);
  const ageHours = hoursSince(createdAtIso);

  // Resolve email from any of the Clients table's email fields. Order matters —
  // Personal Email is the primary contact email; vendhub_email is for the
  // operator app sync. Falls back to legacy "Best Email" for any leftover
  // Student Onboarding rows.
  const resolvedEmail = (
    (f["Personal Email"] as string) ||
    (f["Email"] as string) ||
    (f["Business Email"] as string) ||
    (f["vendhub_email"] as string) ||
    (f["Best Email"] as string) ||
    ""
  ).trim();

  // Per-step inference
  const steps: StepState[] = STEP_ORDER.map((id) => {
    const label = STEP_LABELS[id];
    const openError = latestErrorByStep[id];
    const base: StepState = { id, label, status: "pending" };

    const errorFromOpen = openError
      ? {
          status: "error" as const,
          errorMessage: buildErrorMeta(id, openError).message,
          error: buildErrorMeta(id, openError),
          errorRecordId: openError.id,
        }
      : null;

    if (id === "close_crm") {
      // Clients table uses "Client ID*" (autoNumber). Student Onboarding
      // table used "Client ID" (text containing the Close lead_* id).
      // Per user direction: classify success ONLY when Client ID is present.
      // Hubspot Deal ID alone does NOT count.
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen, detail: errorFromOpen.error.type };
      }
      const clientIdAny = (f["Client ID"] ?? f["Client ID*"]) as string | number | undefined;
      const clientIdStr = clientIdAny !== undefined && clientIdAny !== null ? String(clientIdAny) : "";
      if (clientIdStr.startsWith("lead_")) {
        return { ...base, status: "success", detail: clientIdStr };
      }
      if (clientIdStr) {
        return { ...base, status: "success", detail: `Client #${clientIdStr}` };
      }
      return { ...base, status: "pending" };
    }

    if (id === "email_validation") {
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }
      // Downstream success implies email was validated upstream.
      const mnOk = isTruthy(f["MN Invite Granted"]) || isTruthy(f["MN Invite ID"]) || isTruthy(f["On Mighty Networks"]);
      const intercomOk = isTruthy(f["Intercom Synced"]);
      if (resolvedEmail && (mnOk || intercomOk || isTruthy(f["Sent Email File"]))) {
        return { ...base, status: "success", detail: resolvedEmail };
      }
      if (resolvedEmail) {
        return { ...base, status: "success", detail: resolvedEmail };
      }
      // No email anywhere — Personal / Business / Email / vendhub_email / Best Email all empty.
      if (!resolvedEmail && ageHours > 24) {
        return {
          ...base,
          status: "error",
          errorMessage: "No email on record — every email field is empty, blocks downstream steps",
          error: {
            message: "No email on record — every email field is empty, blocks downstream steps",
            humanized: false,
            type: "Missing email on Client",
            node: "Source CRM — should populate Personal Email or Business Email",
          },
          detail: "Blocked — no email",
        };
      }
      return { ...base, status: "pending" };
    }

    if (id === "airtable_record") {
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen, detail: errorFromOpen.error.type };
      }
      // We're reading the Clients table — the row's existence is the success
      // signal. (When the source was Student Onboarding, we additionally checked
      // for a linked Clients record. Now we ARE the Client.)
      return {
        ...base,
        status: "success",
        detail: "Client record present",
      };
    }

    if (id === "mighty_networks") {
      // Mighty Networks ONLY — Skool is a separate platform that's been
      // deprecated. We do NOT infer MN membership from Skool fields.
      // Source of truth: "On Mighty Networks" + "MN Join Date" + "MN Member ID"
      // (populated by the MA — Verify Mighty Networks Direct n8n workflow).
      const onMN = ((f["On Mighty Networks"] as string) || "").toLowerCase();
      const mnJoinDate = (f["MN Join Date"] as string) || undefined;
      const mnMemberId = (f["MN Member ID"] as string) || undefined;

      // Legacy: still honor MN Verified column on Student Onboarding rows.
      const mnVerified = ((f["MN Verified"] as string) || "").trim();
      const mnVerifiedAt = (f["MN Verified At"] as string) || undefined;
      const granted = f["MN Invite Granted"] as string | undefined;
      const mnInviteId = f["MN Invite ID"] as string | undefined;

      // Verified-as-member (real check via MN Admin API) wins
      if (onMN === "verified" || onMN === "yes" || mnJoinDate || isTruthy(mnMemberId)) {
        return {
          ...base,
          status: "success",
          detail: mnJoinDate
            ? `Joined ${mnJoinDate.split("T")[0]}`
            : mnMemberId
              ? `MN member #${mnMemberId}`
              : "On Mighty Networks",
        };
      }
      if (mnVerified === "Member" || mnVerified === "Joined" || mnVerified === "Active") {
        return {
          ...base,
          status: "success",
          detail: mnVerifiedAt ? `Member since ${mnVerifiedAt.split("T")[0]}` : "Verified member",
        };
      }

      // Confirmed "not in MN" by the API.
      // 14-day grace window: brand-new active clients haven't had time to
      // accept their invite yet, so don't classify as error. After 14 days
      // it becomes a real onboarding gap (system never invited OR customer
      // ghosted) and gets escalated to error.
      const MN_GRACE_HOURS = 14 * 24;
      if (onMN === "not imported" || onMN === "no" || onMN === "waiting") {
        const explicitlyInvited = onMN === "waiting" || isTruthy(granted) || isTruthy(mnInviteId);
        const withinGrace = ageHours < MN_GRACE_HOURS;
        if (explicitlyInvited || withinGrace) {
          return {
            ...base,
            status: "waiting_for_customer",
            waitingOnCustomer: true,
            detail: mnInviteId
              ? `Invite sent · waiting to join (#${mnInviteId})`
              : explicitlyInvited
                ? "Invite sent · waiting to join"
                : `New signup · ${Math.max(1, Math.round(ageHours))}h since added`,
          };
        }
        // If there's an open Onboarding Errors row for this lead/step, prefer
        // it over the synthetic verifier error — that way the New Errors view
        // (which filters by `errorRecordId`) actually surfaces these and the
        // "Resubmit all platforms" button can fire the n8n retry path.
        if (errorFromOpen) {
          return { ...base, ...errorFromOpen };
        }
        return {
          ...base,
          status: "error",
          errorMessage: "Not in Mighty Networks",
          error: {
            message: "Email not found in Mighty Networks community",
            humanized: false,
            type: "MN verification miss",
            node: "MA — Verify Mighty Networks Direct (Vercel)",
          },
        };
      }

      // Invite sent on legacy Student Onboarding row but no live MN check yet.
      if (isTruthy(granted) || isTruthy(mnInviteId)) {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: mnInviteId ? `Invite sent · waiting to join (#${mnInviteId})` : "Invite sent · waiting to join",
        };
      }

      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }
      return { ...base, status: "pending" };
    }

    if (id === "intercom") {
      const verified = (f["Intercom Verified"] as string) || "";
      const syncedAt = f["Intercom Synced At"] as string | undefined;
      // Clients table uses "Intercom Synced" (text). Either column counts.
      const intercomSynced = isTruthy(f["Intercom Synced"]) || isTruthy(syncedAt);
      const hardFailed = isTruthy(f["Intercome Failed?"]);

      if (!resolvedEmail) {
        return { ...base, status: "pending", detail: "Blocked — no email" };
      }

      if (verified === "Verified") {
        return {
          ...base,
          status: "success",
          detail: `Verified ${((f["Intercom Verified At"] as string) || "").split("T")[0]}`,
        };
      }

      // Real-data check: Intercom Synced is populated by /api/verify/intercom
      // which hits Intercom contacts API per email. Values:
      //   "Verified"      = found in Intercom (we also captured Intercom Contact ID)
      //   "Not imported"  = email not found in Intercom (real onboarding gap)
      //   "Waiting"       = legacy: synced but not verified yet
      //   blank           = not yet checked
      const intercomSyncedFlag = ((f["Intercom Synced"] as string) || "").toLowerCase();
      const intercomVerifiedAt = (f["Intercom Verified At"] as string) || undefined;
      const intercomContactId = (f["Intercom Contact ID"] as string) || undefined;
      if (
        intercomSyncedFlag === "verified" ||
        intercomSyncedFlag === "yes" ||
        intercomSyncedFlag === "true" ||
        intercomContactId
      ) {
        return {
          ...base,
          status: "success",
          detail: intercomContactId
            ? `Verified · Intercom #${intercomContactId.slice(-6)}`
            : intercomVerifiedAt
              ? `Verified ${intercomVerifiedAt.split("T")[0]}`
              : "Verified in Intercom",
        };
      }
      if (intercomSyncedFlag === "waiting") {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: "Invited · waiting to be imported",
        };
      }
      if (intercomSyncedFlag === "not imported" || intercomSyncedFlag === "no" || intercomSyncedFlag === "false") {
        // Same logic as the MN branch — when there's an open Onboarding Error
        // row for this lead at the intercom step, prefer it so the New Errors
        // view can attach the Resubmit button to it.
        if (errorFromOpen) {
          return { ...base, ...errorFromOpen };
        }
        return {
          ...base,
          status: "error",
          errorMessage: "Contact not in Intercom",
          error: {
            message: "Contact not found in Intercom — onboarding gap",
            humanized: false,
            type: "Intercom verification miss",
            node: "MA — Verify Intercom (Vercel)",
          },
        };
      }

      if (hardFailed && !intercomSynced && openError) {
        return {
          ...base,
          status: "error",
          errorMessage: "Intercom sync flagged as failed in Airtable",
          error: {
            message: "Intercom sync flagged as failed in Airtable",
            humanized: false,
            type: "Airtable flag",
            node: "Intercom sync node",
          },
        };
      }

      const upstreamProgressed =
        intercomSynced ||
        isTruthy(f["MN Invite Granted"]) ||
        isTruthy(f["MN Invite ID"]) ||
        isTruthy(f["Skool Granted"]) ||
        isTruthy(f["Was Email sent"]) ||
        isTruthy(f["Sent Email File"]);

      if (upstreamProgressed) {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: verified === "Not Found"
            ? "Synced · waiting for lead to confirm"
            : intercomSynced ? "Synced · awaiting Intercom verification" : "Awaiting Intercom verification",
        };
      }

      if (verified === "Not Found" && ageHours < 48) {
        return { ...base, status: "pending", detail: "Awaiting Intercom sync" };
      }

      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }

      if (verified === "Not Found" && ageHours >= 48) {
        return {
          ...base,
          status: "error",
          errorMessage: "Contact missing from Intercom after 48h",
          error: {
            message: "Contact missing from Intercom after 48h",
            humanized: false,
            type: "Intercom verification miss",
            node: "MA — Verify: Intercom All (n8n)",
            timestamp: (f["Intercom Verified At"] as string) || undefined,
          },
        };
      }

      return { ...base, status: "pending", detail: "Awaiting verification" };
    }

    if (id === "vendhub") {
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }
      // Live-verified from the VendHub Activated Users Google Sheet (via MA Verify: VendHub All)
      const vhStatus = ((f["VendHub Status"] as string) || "").toUpperCase();
      const org = (f["VendHub Organization"] as string) || undefined;
      const userId = (f["VendHub User ID"] as string) || undefined;
      // Every signal Airtable carries that says "this customer is on VendHub":
      //  - `On Vendstack` (singleSelect Yes/No)  → manually flipped by team
      //  - `in_vendhub`   (checkbox)             → set by Google Sheet sync flow
      //  - `Has Machine`  (formula Yes/No)       → derived from Machines Placed
      //  - `Machines Placed` / `Total Number of Machines` → numeric count
      //  - `Vendhub Participation` (number)      → secondary integer flag
      //  - `VendHub Data Sync` (linked records)  → at least one matching row in the
      //                                            VendHub data-sync table = on VendHub
      //  - "Should have access to App?" lookup   → from data-sync table
      const onVendstack = ((f["On Vendstack"] as string) || "").toLowerCase() === "yes";
      const inVendhub = isTruthy(f["in_vendhub"]);
      const hasMachine = ((f["Has Machine"] as string) || "").toLowerCase() === "yes";
      const invitedToVendhub = isTruthy(f["Invited to VendHUB"]) || isTruthy(f["invited_to_vendhub"]);
      const machinesPlaced = Number(f["Machines Placed"]) || Number(f["Total Number of Machines"]) || 0;
      const participation = Number(f["Vendhub Participation"]) || 0;
      const dataSyncLinks = f["VendHub Data Sync"];
      const hasDataSyncLink = Array.isArray(dataSyncLinks) && dataSyncLinks.length > 0;
      const accessLookup = f["Should have access to App? (Number) (from VendHub Data Sync)"];
      const hasAccessFlag = Array.isArray(accessLookup)
        ? accessLookup.some((v) => Number(v) > 0 || v === true)
        : Number(accessLookup) > 0;

      if (
        onVendstack ||
        inVendhub ||
        hasMachine ||
        machinesPlaced > 0 ||
        participation > 0 ||
        hasDataSyncLink ||
        hasAccessFlag
      ) {
        return {
          ...base,
          status: "success",
          detail: machinesPlaced > 0
            ? `${machinesPlaced} machine${machinesPlaced === 1 ? "" : "s"} placed`
            : hasDataSyncLink
              ? "On VendHub (data sync)"
              : "On VendHub",
        };
      }
      if (invitedToVendhub) {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: "Invited · waiting to activate",
        };
      }
      if (vhStatus === "ACTIVE") {
        return {
          ...base,
          status: "success",
          detail: org ? `${org}` : userId ? `User ${userId}` : "Active subscription",
        };
      }
      if (vhStatus === "PENDING") {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: org ? `${org} · pending activation` : "Pending activation",
        };
      }
      if (vhStatus === "CANCELED") {
        // Real subscription cancellation — this is a customer churn signal,
        // not a waiting state. Keep as error.
        return {
          ...base,
          status: "error",
          errorMessage: "VendHub subscription canceled",
          detail: org || undefined,
          error: {
            message: "VendHub subscription canceled",
            humanized: false,
            type: "Subscription cancellation",
            node: "VendHub Activated Users sheet",
            timestamp: (f["VendHub Verified At"] as string) || undefined,
          },
        };
      }
      if (vhStatus === "NOT FOUND") {
        // Regardless of age, this is waiting on the customer to sign up on
        // VendHub — the invite / onboarding email has gone out, they
        // haven't acted yet. Not an ops error.
        const detail = ageHours < 7 * 24
          ? "Not yet activated in VendHub"
          : `Not yet activated · ${Math.round(ageHours / 24)} days since signup`;
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail,
        };
      }
      return { ...base, status: "pending", detail: "Awaiting verification" };
    }

    return base;
  });

  // Compute overall
  let currentStepIndex = steps.findIndex((s) => s.status !== "success");
  if (currentStepIndex < 0) currentStepIndex = steps.length - 1;

  // Per-platform customer-wait flags, used for the sub-breakdown on the
  // "Waiting for customer" KPI.
  const waitingOnMN = steps.some((s) => s.id === "mighty_networks" && s.waitingOnCustomer);
  const waitingOnIntercom = steps.some((s) => s.id === "intercom" && s.waitingOnCustomer);
  const waitingOnVendhub = steps.some((s) => s.id === "vendhub" && s.waitingOnCustomer);
  const anyWaiting = waitingOnMN || waitingOnIntercom || waitingOnVendhub;
  const anyRealError = steps.some((s) => s.status === "error");

  let overallStatus: StepStatus = "success";
  if (anyRealError) {
    // Real ops failure trumps everything — someone needs to act on our side.
    overallStatus = "error";
  } else if (anyWaiting) {
    // No real errors, and at least one step is waiting on the customer.
    // This is the new unified bucket: "we've done our part".
    overallStatus = "waiting_for_customer";
  } else if (steps.some((s) => s.status === "pending" || s.status === "in_progress")) {
    overallStatus = "in_progress";
  } else if (steps.every((s) => s.status === "success")) {
    overallStatus = "success";
  }

  // Map Clients-table fields onto our canonical LeadPipeline shape. Where
  // the Clients table doesn't carry an exact equivalent (e.g. it uses
  // "Membership Level" instead of "Program Tier Purchased"), we substitute
  // the closest field. resolvedEmail was already coalesced above.
  const clientIdRaw = f["Client ID"] ?? f["Client ID*"];
  const clientIdStr = clientIdRaw !== undefined && clientIdRaw !== null ? String(clientIdRaw) : undefined;
  return {
    id: student.id,
    fullName: (f["Full Name"] as string) || "",
    email: resolvedEmail,
    clientId: clientIdStr,
    programTier:
      (f["Program Tier Purchased"] as string) ||
      (f["Membership Level (Text)"] as string) ||
      (f["Membership Level"] as string) ||
      undefined,
    salesRep: (f["Sales Rep"] as string) || undefined,
    createdAt: createdAtIso,
    lastUpdatedAt:
      (f["Last Modified Time (All Fields)"] as string) ||
      (f["Wins Last Updated"] as string) ||
      undefined,
    steps,
    overallStatus,
    currentStepIndex,
    mnInviteId: (f["MN Invite ID"] as string) || undefined,
    mnMemberId: (f["MN Member ID"] as string) || undefined,
    intercomContactId: (f["Intercom Contact ID"] as string) || undefined,
    closeLeadId:
      ((f["Close Lead ID"] as string) || "").trim() ||
      (clientIdStr && clientIdStr.startsWith("lead_") ? clientIdStr : undefined),
    vendHubOrganization: (f["VendHub Organization"] as string) || undefined,
    vendHubUserId: (f["VendHub User ID"] as string) || undefined,
    airtableRecordId: student.id,
    activeStatus: (() => {
      // The Clients table has `⚙️ Active Client?` (formula → "Yes"/"No").
      // The Account Status singleSelect (Active/Cancelled/Waiting) overrides
      // when set. Fresh rows (< 3 days old) get a 3-day grace period as
      // "new_waiting" so newly imported leads are still visible to the team.
      const acctStatus = ((f["Account Status"] as string) || "").toLowerCase();
      if (acctStatus === "cancelled") return "inactive" as const;
      if (acctStatus === "waiting") return "new_waiting" as const;
      if (acctStatus === "active") return "active" as const;
      const activeClient = ((f["⚙️ Active Client?"] as string) || "").toLowerCase();
      if (activeClient === "yes") return "active" as const;
      // 3-day grace period for fresh rows
      if (createdAtIso && hoursSince(createdAtIso) < 72) return "new_waiting" as const;
      return "inactive" as const;
    })(),
    waitingOnMN,
    waitingOnIntercom,
    waitingOnVendhub,
  };
}

/**
 * Fetch the full pipeline view — every Client joined with their error rows.
 *
 * Source of truth is the Clients table (`tblwDucKYAsPDVBA2`). Errors come
 * from the Onboarding Errors table and are joined by lowercased email
 * (Clients don't carry a Close `lead_*` id).
 */
export async function fetchPipeline(options?: {
  max?: number;
  cacheTtl?: number;
}): Promise<LeadPipeline[]> {
  const max = options?.max;
  const cacheTtl = options?.cacheTtl;

  const [students, errors] = await Promise.all([
    fetchTable("clients", {
      fields: [
        // Identity (only fields that ACTUALLY exist on Clients table tblwDucKYAsPDVBA2)
        "Full Name",
        "Personal Email",
        "Business Email",
        "Phone Number",
        "Client ID*",
        "Hubspot Deal ID",
        "Sales Rep",
        "Date Added",
        // Membership / pipeline-tier
        "Membership Level",
        "Membership Level (Text)",
        "Status",
        "Program Stages",
        // Email-validation downstream signals
        "Sent Email File",
        "Welcome Email Sent: ", // trailing space is intentional — that's the actual field name
        // Mighty Networks (real source of truth, populated by n8n verifier)
        "On Mighty Networks",
        "MN Join Date",
        "MN Member ID",
        // MN invitation signals — populated by the New Student Onboarding
        // flow at the moment we issue an invite. Without these, the
        // classifier can't tell "we never invited" from "invite sent,
        // waiting for customer to accept" and incorrectly flags every
        // not-yet-joined lead as an error past the 14-day grace window.
        "MN Invite ID",
        "MN Invite Granted",
        // Intercom (real source of truth, populated by /api/verify/intercom).
        // Only the fields that actually exist as columns on the Clients
        // table — adding non-existent ones makes Airtable reject the
        // entire fields[] request with UNKNOWN_FIELD_NAME.
        "Intercom Synced",
        "Intercom Verified At",
        "Intercom Contact ID",
        "vendhub_email",
        // Close Lead ID (legacy text field for deep-linking back to Close)
        "Close Lead ID",
        // VendHub — read every signal Airtable carries so the classifier
        // doesn't miss customers who are already on VendHub. The Google
        // Sheet sync (n8n) populates VendHub Data Sync linked records
        // and `in_vendhub`; the team manually flips `On Vendstack` when
        // a customer is fully onboarded; `Has Machine` is a formula based
        // on Machines Placed.
        "On Vendstack",
        "in_vendhub",
        "Invited to VendHUB",
        "invited_to_vendhub",
        "Has Machine",
        "Machines Placed",
        "Vendhub Participation",
        "VendHub Data Sync",
        "Should have access to App? (Number) (from VendHub Data Sync)",
        // Active client lifecycle (used by the dashboard's Active filter)
        "⚙️ Active Client?",
        "Account Status",
      ],
      sort: [{ field: "Date Added", direction: "desc" }],
      ...(max !== undefined ? { maxRecords: max } : {}),
      cacheTtl,
    }),
    fetchTable("onboardingErrors", {
      fields: [
        "Lead Name", "Lead ID", "Email",
        "Error Type", "Error Message", "Error Node",
        "Timestamp", "Status", "Execution ID",
        "Raw Error Data",
      ],
      cacheTtl,
    }),
  ]);

  // Index errors by lead id (the Close lead_... id stored in "Lead ID")
  // and by lowercased email as a fallback.
  const errorsByLeadId = new Map<string, AirtableRecord[]>();
  const errorsByEmail = new Map<string, AirtableRecord[]>();

  for (const e of errors) {
    const leadId = (e.fields["Lead ID"] as string) || "";
    const email = ((e.fields["Email"] as string) || "").toLowerCase().trim();
    if (leadId) {
      const arr = errorsByLeadId.get(leadId) || [];
      arr.push(e);
      errorsByLeadId.set(leadId, arr);
    }
    if (email) {
      const arr = errorsByEmail.get(email) || [];
      arr.push(e);
      errorsByEmail.set(email, arr);
    }
  }

  // Track which error rows we've matched to a Clients row so we can
  // surface the rest as ghost-leads further down.
  const matchedErrorIds = new Set<string>();

  const fromClients = students.map((s) => {
    const f = s.fields as Record<string, unknown>;
    // Resolve the Client's email from any of the four email columns.
    const email = ((
      (f["Personal Email"] as string) ||
      (f["Email"] as string) ||
      (f["Business Email"] as string) ||
      (f["vendhub_email"] as string) ||
      ""
    ) || "").toLowerCase().trim();
    // Clients carry a `Hubspot Deal ID` not a Close `lead_*`, so try both
    // when looking up errors. Most matches will come through email.
    const hubspotDealId = String(f["Hubspot Deal ID"] ?? "");
    const clientNum = String((f["Client ID*"] ?? f["Client ID"]) ?? "");
    const related = [
      ...(email ? errorsByEmail.get(email) || [] : []),
      ...(hubspotDealId && hubspotDealId !== "0" ? errorsByLeadId.get(hubspotDealId) || [] : []),
      ...(clientNum ? errorsByLeadId.get(clientNum) || [] : []),
    ];
    const seen = new Set<string>();
    const dedup = related.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    for (const r of dedup) matchedErrorIds.add(r.id);
    return derivePipeline(s, dedup);
  });

  // Ghost-leads: errors in tblaQ6fpHGhRs56sH that have no matching Clients
  // row. These are pre-Client failures (e.g. Close → Airtable handoff broke,
  // so a Client row was never created). The team needs to see them.
  const ghosts = buildGhostLeadsFromErrors(errors, matchedErrorIds);
  return [...fromClients, ...ghosts];
}

/**
 * Build synthetic LeadPipeline entries for open Onboarding Errors rows that
 * never made it into the Clients table. Each one shows up on the dashboard
 * board / errors tab as a red card with the Error Type prominently displayed.
 */
function buildGhostLeadsFromErrors(
  errors: AirtableRecord[],
  matchedIds: Set<string>
): LeadPipeline[] {
  // Group unmatched open errors by lowercased email (or by error record id
  // when no email is present). One ghost lead per email — multiple errors
  // for the same email collapse to a single card surfacing the latest.
  type ErrGroup = { email: string; rows: AirtableRecord[] };
  const groups = new Map<string, ErrGroup>();

  // Treat these as "no real value" placeholders the n8n workflow occasionally
  // writes when the lead context wasn't carried through.
  const isEmptyEmail = (v: string) =>
    !v || v === "—" || v.toLowerCase() === "unknown" || v === "-";
  const isEmptyName = (v: string) =>
    !v || v.toLowerCase() === "unknown" || v === "—" || v === "-";

  for (const e of errors) {
    if (matchedIds.has(e.id)) continue;
    const status = (e.fields["Status"] as string) || "";
    if (status !== "New" && status !== "Investigating") continue;

    const rawEmail = ((e.fields["Email"] as string) || "").trim();
    const rawName = ((e.fields["Lead Name"] as string) || "").trim();
    const rawLeadId = ((e.fields["Lead ID"] as string) || "").trim();

    // Skip malformed rows — no email AND no name AND no Close lead id means
    // the row carries zero actionable lead context, almost always emitted by
    // an n8n workflow that lost the input payload before logging the error.
    // These cannot be retried, deep-linked, or matched to a real client, so
    // we hide them from the dashboard. They're auto-resolved by the cleanup
    // path; surfacing them creates noise and a feedback loop where users
    // resubmit empty rows that re-fail and create more empty rows.
    if (isEmptyEmail(rawEmail) && isEmptyName(rawName) && !rawLeadId) {
      continue;
    }

    const email = rawEmail.toLowerCase();
    const key = email && !isEmptyEmail(rawEmail) ? email : `__no_email__:${e.id}`;
    const g = groups.get(key) || { email: isEmptyEmail(rawEmail) ? "" : email, rows: [] };
    g.rows.push(e);
    groups.set(key, g);
  }

  const ghosts: LeadPipeline[] = [];
  for (const [, g] of groups) {
    // Sort newest first; classifier uses the most recent error's metadata.
    const sortedRows = g.rows
      .slice()
      .sort(
        (a, b) =>
          new Date((b.fields["Timestamp"] as string) || 0).getTime() -
          new Date((a.fields["Timestamp"] as string) || 0).getTime()
      );
    const latest = sortedRows[0];
    const lf = latest.fields as Record<string, unknown>;
    const errType = (lf["Error Type"] as string) || "";
    const errStep = ERROR_TYPE_TO_STEP[errType] || "close_crm";
    const errMeta = buildErrorMeta(errStep, latest);
    const errTimestamp = (lf["Timestamp"] as string) || undefined;

    // Build the 6-stage timeline. The errored stage shows the actual error,
    // earlier stages are pending (we never got past this point), later
    // stages are pending too.
    const errStepIdx = STEP_ORDER.indexOf(errStep);
    const steps: StepState[] = STEP_ORDER.map((id, idx) => {
      const label = STEP_LABELS[id];
      if (idx === errStepIdx) {
        return {
          id,
          label,
          status: "error",
          errorMessage: errMeta.message,
          error: errMeta,
          errorRecordId: latest.id,
        };
      }
      return { id, label, status: "pending" };
    });

    const leadId = (lf["Lead ID"] as string) || "";
    const rawLeadName = ((lf["Lead Name"] as string) || "").trim();
    const cleanLeadName =
      rawLeadName && rawLeadName.toLowerCase() !== "unknown" && rawLeadName !== "—"
        ? rawLeadName
        : "";
    const fullName = cleanLeadName || g.email || "(unknown lead)";
    ghosts.push({
      id: latest.id, // use error record id as the dashboard lead id
      fullName,
      email: g.email,
      clientId: leadId.startsWith("lead_") ? leadId : undefined,
      programTier: undefined,
      salesRep: undefined,
      createdAt: errTimestamp,
      lastUpdatedAt: errTimestamp,
      steps,
      overallStatus: "error",
      currentStepIndex: errStepIdx,
      mnInviteId: undefined,
      mnMemberId: undefined,
      intercomContactId: undefined,
      closeLeadId: leadId.startsWith("lead_") ? leadId : undefined,
      vendHubOrganization: undefined,
      vendHubUserId: undefined,
      airtableRecordId: latest.id,
      // Treat ghost errors as new_waiting so they show up under the Active
      // filter — they're brand-new failures the team needs to fix.
      activeStatus: "new_waiting",
      waitingOnMN: false,
      waitingOnIntercom: false,
      waitingOnVendhub: false,
    });
  }
  return ghosts;
}
