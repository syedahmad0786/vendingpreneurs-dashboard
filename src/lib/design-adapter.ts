/**
 * Adapts the production Airtable-backed LeadPipeline into the shape the
 * Claude Design bundle expects. This keeps the new UI faithful to the
 * design while letting every piece of the backend stay unchanged.
 */

import type { LeadPipeline, StepId } from "./pipeline";
import { timeAgo } from "./format";
import type { PlatformId } from "@/components/design/PlatformLogos";

export interface DesignStage {
  id: PlatformId;
  num: string;
  title: string;
  role: string;
  platform: PlatformId;
  /** original internal step id — so we can refer back to StepState. */
  stepId: StepId;
}

export const DESIGN_STAGES: DesignStage[] = [
  { id: "close",    num: "01", title: "Close CRM",        role: "Lead won",         platform: "close",    stepId: "close_crm" },
  { id: "email",    num: "02", title: "Email validation", role: "Verified",         platform: "email",    stepId: "email_validation" },
  { id: "airtable", num: "03", title: "Airtable",         role: "Student + Client", platform: "airtable", stepId: "airtable_record" },
  { id: "mighty",   num: "04", title: "Mighty Networks",  role: "Community invite", platform: "mighty",   stepId: "mighty_networks" },
  { id: "intercom", num: "05", title: "Intercom",         role: "Contact synced",   platform: "intercom", stepId: "intercom" },
  { id: "vendhub",  num: "06", title: "VendHub",          role: "Operator live",    platform: "vendhub",  stepId: "vendhub" },
];

export type DesignTimelineStatus = "done" | "current" | "error" | "pending";

export interface DesignTimelineEntry {
  stage: PlatformId;
  stepId: StepId;
  status: DesignTimelineStatus;
  at: string;         // timeAgo string
  error?: { code: string; msg: string; node?: string; executionId?: string; errorRecordId?: string };
  detail?: string;
}

export type DesignStatus = "processing" | "error" | "done" | "waiting";

export interface DesignLead {
  // Original record id (Airtable recXXX) so downstream calls still work
  id: string;

  // Mapped identity
  name: string;
  company: string;
  email: string;
  city: string;
  owner: string;              // JR / KW / MV — we use the sales rep initials
  realSalesRep?: string;      // full name of the sales rep for drawer detail

  // Pipeline state
  currentStage: number;       // 0-5 (index into DESIGN_STAGES)
  status: DesignStatus;
  statusError: { code: string; msg: string; node?: string; executionId?: string; errorRecordId?: string } | null;

  // Per-stage timeline
  timeline: DesignTimelineEntry[];

  createdAt: string;          // "3h ago" style
  createdAtRaw?: string;      // raw ISO — used for bucketing in Analytics
  retries: number;

  // Waiting-on-customer flags so the UI can filter / badge / count.
  waitingOnMN?: boolean;
  waitingOnIntercom?: boolean;
  waitingOnVendhub?: boolean;

  // Carry originals for drawer / retry call
  _originalStepIds: StepId[];
  _clientId?: string;
  _programTier?: string;
  _mnInviteId?: string;
  _vendHubOrganization?: string;
  _vendHubUserId?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function companyFrom(lead: LeadPipeline): string {
  // If we don't have a company, derive a Title Case label from the email domain.
  if (lead.email) {
    const domain = lead.email.split("@")[1] || "";
    const base = domain.split(".")[0];
    if (base && !["gmail", "yahoo", "hotmail", "outlook", "proton", "me", "aol", "icloud", "msn", "live"].includes(base.toLowerCase())) {
      return base
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return lead.fullName || "Unnamed operator";
}

function cityFromProgramTier(lead: LeadPipeline): string {
  // We don't have a city in the pipeline today — fall back to the program tier,
  // which reads naturally in the card meta line.
  return lead.programTier || "—";
}

export function adaptLead(lead: LeadPipeline): DesignLead {
  const stages = DESIGN_STAGES;

  // Map each StepState → timeline entry
  const byStepId = new Map<StepId, (typeof lead.steps)[number]>();
  for (const s of lead.steps) byStepId.set(s.id, s);

  let firstNonDone = -1;
  const timeline: DesignTimelineEntry[] = stages.map((stage, i) => {
    const step = byStepId.get(stage.stepId);
    if (!step) {
      return { stage: stage.id, stepId: stage.stepId, status: "pending", at: "Waiting" };
    }
    let tlStatus: DesignTimelineStatus;
    if (step.status === "success") tlStatus = "done";
    else if (step.status === "error") {
      tlStatus = "error";
      if (firstNonDone === -1) firstNonDone = i;
    } else if (step.status === "in_progress" || step.status === "waiting_for_customer") {
      tlStatus = "current";
      if (firstNonDone === -1) firstNonDone = i;
    } else {
      tlStatus = firstNonDone === -1 ? "current" : "pending";
      if (firstNonDone === -1) firstNonDone = i;
    }
    return {
      stage: stage.id,
      stepId: stage.stepId,
      status: tlStatus,
      at: step.status === "success" && step.detail
        ? "Completed"
        : step.status === "error"
        ? timeAgo(step.error?.timestamp) || "Recently"
        : step.status === "waiting_for_customer"
        ? "Waiting on customer"
        : step.status === "in_progress"
        ? "Running"
        : "Waiting",
      error: step.status === "error" && step.errorMessage
        ? {
            code: step.error?.type || step.label,
            msg: step.errorMessage,
            node: step.error?.node,
            executionId: step.error?.executionId,
            errorRecordId: step.errorRecordId,
          }
        : undefined,
      detail: step.detail,
    };
  });

  if (firstNonDone === -1) firstNonDone = stages.length - 1;

  // Overall status
  let status: DesignStatus;
  if (lead.overallStatus === "error") status = "error";
  else if (lead.overallStatus === "success") status = "done";
  else if (lead.overallStatus === "waiting_for_customer") status = "waiting";
  else status = "processing";

  // Latest open error
  const firstError = lead.steps.find((s) => s.status === "error");
  const statusError = firstError && firstError.errorMessage
    ? {
        code: firstError.error?.type || firstError.label,
        msg: firstError.errorMessage,
        node: firstError.error?.node,
        executionId: firstError.error?.executionId,
        errorRecordId: firstError.errorRecordId,
      }
    : null;

  const ownerInitials = lead.salesRep ? initialsOf(lead.salesRep) : "—";

  return {
    id: lead.id,
    name: lead.fullName || "Unnamed operator",
    company: companyFrom(lead),
    email: lead.email || "—",
    city: cityFromProgramTier(lead),
    owner: ownerInitials,
    realSalesRep: lead.salesRep,
    currentStage: firstNonDone,
    status,
    statusError,
    timeline,
    createdAt: timeAgo(lead.createdAt),
    createdAtRaw: lead.createdAt,
    retries: 0,
    waitingOnMN: lead.waitingOnMN,
    waitingOnIntercom: lead.waitingOnIntercom,
    waitingOnVendhub: lead.waitingOnVendhub,
    _originalStepIds: lead.steps.map((s) => s.id),
    _clientId: lead.clientId,
    _programTier: lead.programTier,
    _mnInviteId: lead.mnInviteId,
    _vendHubOrganization: lead.vendHubOrganization,
    _vendHubUserId: lead.vendHubUserId,
  };
}

export function adaptLeads(leads: LeadPipeline[]): DesignLead[] {
  return leads.map(adaptLead);
}
