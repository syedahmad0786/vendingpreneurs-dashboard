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
  const STALE_HOURS = 14 * 24;
  const openErrors = errorsForLead
    .filter((r) => {
      const s = (r.fields["Status"] as string) || "";
      if (s !== "New" && s !== "Investigating") return false;
      const ts = r.fields["Timestamp"] as string | undefined;
      if (ts && hoursSince(ts) > STALE_HOURS) return false;
      return true;
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
    const step = ERROR_TYPE_TO_STEP[type];
    if (step && !latestErrorByStep[step]) latestErrorByStep[step] = err;
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

      // Confirmed "not in MN" by the API. If they were invited, waiting on
      // the customer to accept. Otherwise it's an open MN error / not yet
      // invited.
      if (onMN === "not imported" || onMN === "no" || onMN === "waiting") {
        if (onMN === "waiting" || isTruthy(granted) || isTruthy(mnInviteId)) {
          return {
            ...base,
            status: "waiting_for_customer",
            waitingOnCustomer: true,
            detail: mnInviteId ? `Invite sent · waiting to join (#${mnInviteId})` : "Invite sent · waiting to join",
          };
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
      // Clients-table-only signals: On Vendstack=Yes / in_vendhub=true /
      // Has Machine=Yes — any of these confirm the customer is set up on VendHub.
      const onVendstack = ((f["On Vendstack"] as string) || "").toLowerCase() === "yes";
      const inVendhub = isTruthy(f["in_vendhub"]);
      const hasMachine = ((f["Has Machine"] as string) || "").toLowerCase() === "yes";
      const invitedToVendhub = isTruthy(f["Invited to VendHUB"]) || isTruthy(f["invited_to_vendhub"]);
      const machinesPlaced = Number(f["Machines Placed"]) || Number(f["Total Number of Machines"]) || 0;
      if (onVendstack || inVendhub || hasMachine || machinesPlaced > 0) {
        return {
          ...base,
          status: "success",
          detail: machinesPlaced > 0
            ? `${machinesPlaced} machine${machinesPlaced === 1 ? "" : "s"} placed`
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
        // Intercom (real source of truth, populated by /api/verify/intercom)
        "Intercom Synced",
        "Intercom Verified At",
        "Intercom Contact ID",
        // Close Lead ID (legacy text field for deep-linking back to Close)
        "Close Lead ID",
        // VendHub
        "On Vendstack",
        "Invited to VendHUB",
        "Has Machine",
        "Machines Placed",
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

  return students.map((s) => {
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
    return derivePipeline(s, dedup);
  });
}
