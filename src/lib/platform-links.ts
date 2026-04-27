/**
 * Platform deep-link helpers.
 *
 * Returns a fully-formed URL for opening a record in its native platform UI.
 * If the required identifier isn't present, returns null so callers can hide
 * the link rather than dead-link.
 */

import type { LeadPipeline } from "./pipeline";

const AIRTABLE_BASE = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "appgqED05AlPLi0ar";
const AIRTABLE_CLIENTS_TABLE = "tblwDucKYAsPDVBA2";
// Mighty Networks community URL slug (community.vendingpreneurs.com).
// Tweak via NEXT_PUBLIC_MN_COMMUNITY_HOST if the slug changes.
const MN_HOST = process.env.NEXT_PUBLIC_MN_COMMUNITY_HOST || "community.vendingpreneurs.com";
// Intercom workspace id is part of the URL pattern.
const INTERCOM_APP = process.env.NEXT_PUBLIC_INTERCOM_APP_ID || "_";
// VendHub UI host. The product lives on the marketing domain (Clerk-gated)
// at www.vendhubhq.com — there is no app.vendhubhq.com subdomain.
const VENDHUB_HOST = process.env.NEXT_PUBLIC_VENDHUB_HOST || "www.vendhubhq.com";
// Close CRM org identifier — leave default to use the global lead URL.
const CLOSE_HOST = "app.close.com";

export type Platform =
  | "close"
  | "airtable"
  | "email"
  | "mighty"
  | "intercom"
  | "vendhub";

/** Public face of a deep-link target. */
export interface PlatformLink {
  platform: Platform;
  /** Display label, e.g. "Open in Intercom". */
  label: string;
  /** Fully-formed URL the dashboard opens in a new tab. */
  url: string;
  /** Short in-line ID we render next to the link, e.g. "lead_abc". */
  externalId?: string;
}

/**
 * Build a Close CRM lead link.
 *
 * If we have the canonical Close `lead_*` id → direct lead URL.
 * If we only have an email → search URL so users can still find the record.
 * Otherwise null (button hidden).
 */
export function closeLink(leadId?: string, email?: string): PlatformLink | null {
  if (leadId && leadId.startsWith("lead_")) {
    return {
      platform: "close",
      label: "Open in Close",
      url: `https://${CLOSE_HOST}/lead/${leadId}/`,
      externalId: leadId,
    };
  }
  if (email) {
    return {
      platform: "close",
      label: "Search in Close",
      url: `https://${CLOSE_HOST}/search/${encodeURIComponent(email)}/`,
      externalId: email,
    };
  }
  return null;
}

/** Build a Mighty Networks member link. */
export function mightyLink(memberId?: string): PlatformLink | null {
  if (!memberId) return null;
  return {
    platform: "mighty",
    label: "Open in Mighty Networks",
    url: `https://${MN_HOST}/members/${memberId}`,
    externalId: memberId,
  };
}

/**
 * Build an Intercom contact link.
 * If we have the contact id → direct contact URL.
 * If we only have email → contact search URL (still useful).
 */
export function intercomLink(contactId?: string, email?: string): PlatformLink | null {
  if (contactId) {
    return {
      platform: "intercom",
      label: "Open in Intercom",
      url: `https://app.intercom.com/a/apps/${INTERCOM_APP}/users/${contactId}/all-conversations`,
      externalId: contactId,
    };
  }
  if (email) {
    return {
      platform: "intercom",
      label: "Search in Intercom",
      url: `https://app.intercom.com/a/apps/${INTERCOM_APP}/users/search?query=${encodeURIComponent(email)}`,
      externalId: email,
    };
  }
  return null;
}

/**
 * Build a VendHub user/org link. The exact internal route varies by VendHub
 * tenant — we route to /dashboard which lands authenticated users in the
 * right place, then they can navigate to the operator. Tweak via
 * NEXT_PUBLIC_VENDHUB_HOST + NEXT_PUBLIC_VENDHUB_USER_PATH if needed.
 */
export function vendhubLink(userId?: string, org?: string): PlatformLink | null {
  if (!userId && !org) {
    // No user/org id at all → land them in the VendHub dashboard root
    return {
      platform: "vendhub",
      label: "Open VendHub dashboard",
      url: `https://${VENDHUB_HOST}/dashboard`,
    };
  }
  const userPath = process.env.NEXT_PUBLIC_VENDHUB_USER_PATH || "operators";
  const orgPath = process.env.NEXT_PUBLIC_VENDHUB_ORG_PATH || "organizations";
  return {
    platform: "vendhub",
    label: "Open in VendHub",
    url: userId
      ? `https://${VENDHUB_HOST}/${userPath}/${encodeURIComponent(userId)}`
      : `https://${VENDHUB_HOST}/${orgPath}/${encodeURIComponent(org!)}`,
    externalId: userId || org,
  };
}

/** Build an Airtable record link. */
export function airtableLink(recordId?: string, tableId: string = AIRTABLE_CLIENTS_TABLE): PlatformLink | null {
  if (!recordId) return null;
  return {
    platform: "airtable",
    label: "Open in Airtable",
    url: `https://airtable.com/${AIRTABLE_BASE}/${tableId}/${recordId}`,
    externalId: recordId,
  };
}

/** Build a mailto link for a verified contact email. */
export function emailLink(email?: string): PlatformLink | null {
  if (!email) return null;
  return {
    platform: "email",
    label: "Email",
    url: `mailto:${email}`,
    externalId: email,
  };
}

/**
 * Get all available platform links for a lead, in pipeline order.
 * Hidden when the relevant ID isn't on the record yet.
 */
export function platformLinksForLead(lead: LeadPipeline): PlatformLink[] {
  return [
    closeLink(lead.closeLeadId || lead.clientId, lead.email),
    emailLink(lead.email),
    airtableLink(lead.airtableRecordId),
    mightyLink(lead.mnMemberId),
    intercomLink(lead.intercomContactId, lead.email),
    vendhubLink(lead.vendHubUserId, lead.vendHubOrganization),
  ].filter((x): x is PlatformLink => Boolean(x));
}

/** Get the deep link for a specific pipeline step on a lead. */
export function platformLinkForStep(lead: LeadPipeline, stepId: string): PlatformLink | null {
  switch (stepId) {
    case "close_crm":
      return closeLink(lead.closeLeadId || lead.clientId, lead.email);
    case "email_validation":
      return emailLink(lead.email);
    case "airtable_record":
      return airtableLink(lead.airtableRecordId);
    case "mighty_networks":
      return mightyLink(lead.mnMemberId);
    case "intercom":
      return intercomLink(lead.intercomContactId, lead.email);
    case "vendhub":
      return vendhubLink(lead.vendHubUserId, lead.vendHubOrganization);
    default:
      return null;
  }
}
