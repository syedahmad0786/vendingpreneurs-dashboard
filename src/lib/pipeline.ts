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
  vendHubOrganization?: string;
  vendHubUserId?: string;
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

  const createdAtIso = f["Create Date"] as string | undefined;
  const ageHours = hoursSince(createdAtIso);

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
      const clientId = f["Client ID"] as string | undefined;
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen, detail: errorFromOpen.error.type };
      }
      if (clientId && clientId.startsWith("lead_")) {
        return { ...base, status: "success", detail: clientId };
      }
      return { ...base, status: "pending" };
    }

    if (id === "email_validation") {
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }
      const bestEmail = ((f["Best Email"] as string) || "").trim();
      // Downstream success implies email was validated upstream.
      const mnOk = isTruthy(f["MN Invite Granted"]) || isTruthy(f["MN Invite ID"]);
      const intercomOk = isTruthy(f["Intercom Synced At"]);
      if (mnOk || intercomOk || isTruthy(f["Was Email sent"])) {
        return { ...base, status: "success", detail: bestEmail || undefined };
      }
      // No email on record at all — the onboarding workflow never pulled the
      // email from Close CRM successfully. Nothing downstream can happen until
      // this is fixed, so surface it here rather than as a cascade of downstream errors.
      if (!bestEmail && ageHours > 24) {
        return {
          ...base,
          status: "error",
          errorMessage: "No email on record — Close CRM lead is missing an email, blocks all downstream steps",
          error: {
            message: "No email on record — Close CRM lead is missing an email, blocks all downstream steps",
            humanized: false,
            type: "Missing email on Close lead",
            node: "Main onboarding workflow — Pull email from Close CRM",
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
      // The student record itself exists whenever we see this lead.
      // Consider the step "fully done" when a Clients record is linked too.
      const hasStudent = Boolean(student.id);
      const clientsLink = f["Clients"];
      const hasClient = Array.isArray(clientsLink) && (clientsLink as unknown[]).length > 0;
      if (hasStudent && hasClient) {
        return {
          ...base,
          status: "success",
          detail: `Student + Client linked`,
        };
      }
      if (hasStudent) {
        return {
          ...base,
          status: "success",
          detail: "Student record created",
        };
      }
      return { ...base, status: "pending", detail: "Awaiting record creation" };
    }

    if (id === "mighty_networks") {
      const granted = f["MN Invite Granted"] as string | undefined;
      const mnId = f["MN Invite ID"] as string | undefined;
      const mnVerified = ((f["MN Verified"] as string) || "").trim();
      const mnVerifiedAt = (f["MN Verified At"] as string) || undefined;

      // Live-verified as a joined member — always wins
      if (mnVerified === "Member" || mnVerified === "Joined" || mnVerified === "Active") {
        return {
          ...base,
          status: "success",
          detail: mnVerifiedAt ? `Member since ${mnVerifiedAt.split("T")[0]}` : "Verified member",
        };
      }

      // Invite was successfully sent — the onboarding side worked.
      // The lead just hasn't accepted yet. This is NOT an error — it's waiting.
      // This takes precedence over stale error records that were logged before
      // the invite eventually went out, or when n8n mis-flagged a success as a failure.
      if (isTruthy(granted) || isTruthy(mnId)) {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: mnId ? `Invite sent · waiting to join (#${mnId})` : "Invite sent · waiting to join",
        };
      }

      // No invite was sent and there's an open error — surface it.
      if (errorFromOpen) {
        return { ...base, ...errorFromOpen };
      }

      return { ...base, status: "pending" };
    }

    if (id === "intercom") {
      const verified = (f["Intercom Verified"] as string) || "";
      const syncedAt = f["Intercom Synced At"] as string | undefined;
      const hardFailed = isTruthy(f["Intercome Failed?"]);
      const bestEmail = ((f["Best Email"] as string) || "").trim();

      // If there's no email, this step is blocked upstream at email_validation.
      // Don't double-count as an Intercom error.
      if (!bestEmail) {
        return { ...base, status: "pending", detail: "Blocked — no email" };
      }

      // Live-verified from Intercom API — always wins
      if (verified === "Verified") {
        return {
          ...base,
          status: "success",
          detail: `Verified ${((f["Intercom Verified At"] as string) || "").split("T")[0]}`,
        };
      }

      // Hard failure flag set by the main onboarding workflow. We only
      // surface this as an error if there's ALSO an open Airtable error row
      // for the Intercom step. Without that row the flag is just history —
      // once the user marks errors Resolved we stop showing the error.
      if (hardFailed && !isTruthy(syncedAt) && openError) {
        return {
          ...base,
          status: "error",
          errorMessage: "Intercom sync flagged as failed in Airtable",
          error: {
            message: "Intercom sync flagged as failed in Airtable",
            humanized: false,
            type: "Airtable flag",
            node: "Intercom sync node in main onboarding workflow",
          },
        };
      }

      // Upstream onboarding succeeded if anything downstream of email
      // validation worked — that means the Intercom sync call went out.
      // Intercom's public search won't return unconfirmed contacts, so a
      // later "Not Found" from the verify workflow just means the lead
      // hasn't clicked the confirmation email. That's waiting, not error.
      const upstreamProgressed =
        isTruthy(syncedAt) ||
        isTruthy(f["MN Invite Granted"]) ||
        isTruthy(f["MN Invite ID"]) ||
        isTruthy(f["Was Email sent"]);

      if (upstreamProgressed) {
        return {
          ...base,
          status: "waiting_for_customer",
          waitingOnCustomer: true,
          detail: verified === "Not Found"
            ? "Synced · waiting for lead to confirm"
            : "Synced · awaiting Intercom verification",
        };
      }

      if (verified === "Not Found" && ageHours < 48) {
        return { ...base, status: "pending", detail: "Awaiting Intercom sync" };
      }

      // Only reach here if NO sync was ever attempted AND no upstream
      // progress was made. That's a legitimate error.
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

  return {
    id: student.id,
    fullName: (f["Full Name"] as string) || "",
    email: (f["Best Email"] as string) || "",
    clientId: (f["Client ID"] as string) || undefined,
    programTier: (f["Program Tier Purchased"] as string) || undefined,
    salesRep: (f["Sales Rep"] as string) || undefined,
    createdAt: (f["Create Date"] as string) || undefined,
    lastUpdatedAt: (f["Last Modified Time (All Fields)"] as string) || undefined,
    steps,
    overallStatus,
    currentStepIndex,
    mnInviteId: (f["MN Invite ID"] as string) || undefined,
    vendHubOrganization: (f["VendHub Organization"] as string) || undefined,
    vendHubUserId: (f["VendHub User ID"] as string) || undefined,
    waitingOnMN,
    waitingOnIntercom,
    waitingOnVendhub,
  };
}

/**
 * Fetch the full pipeline view — all student onboarding leads joined
 * with their error records.
 */
export async function fetchPipeline(options?: {
  max?: number;
  cacheTtl?: number;
}): Promise<LeadPipeline[]> {
  // No hard cap by default — we paginate Airtable fully and return every
  // unarchived lead. Pass max explicitly only for dev/debug.
  const max = options?.max;
  const cacheTtl = options?.cacheTtl;

  const [students, errors] = await Promise.all([
    fetchTable("studentOnboarding", {
      fields: [
        "Full Name",
        "Best Email",
        "Client ID",
        "Program Tier Purchased",
        "Sales Rep",
        "Create Date",
        "Last Modified Time (All Fields)",
        "Was Email sent",
        "MN Invite Granted",
        "MN Invite ID",
        "MN Verified",
        "MN Verified At",
        "Intercom Synced At",
        "Intercome Failed?",
        "Intercom Verified",
        "Intercom Verified At",
        "VendHub Status",
        "VendHub Verified At",
        "VendHub Organization",
        "VendHub User ID",
        "Skool Granted",
        "Clients",
        "Archived",
      ],
      // No archive filter — we show every lead regardless of the archive flag,
      // so the dashboard is the authoritative view of Airtable state.
      sort: [{ field: "Create Date", direction: "desc" }],
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
    const cid = (s.fields["Client ID"] as string) || "";
    const email = ((s.fields["Best Email"] as string) || "").toLowerCase().trim();
    const related = [
      ...(errorsByLeadId.get(cid) || []),
      ...(email ? errorsByEmail.get(email) || [] : []),
    ];
    // Deduplicate by record id
    const seen = new Set<string>();
    const dedup = related.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    return derivePipeline(s, dedup);
  });
}
