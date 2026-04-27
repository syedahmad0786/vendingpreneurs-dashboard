"use client";

import { useEffect } from "react";
import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";
import {
  closeLink,
  airtableLink,
  mightyLink,
  intercomLink,
  vendhubLink,
  emailLink,
} from "@/lib/platform-links";

export function LeadDrawer({
  lead,
  stages,
  onClose,
  onRetry,
  retryingKeys,
  onResolveError,
  resolvingKeys,
}: {
  lead: DesignLead | null;
  stages: DesignStage[];
  onClose: () => void;
  onRetry: (lead: DesignLead, stageIdx: number) => void;
  retryingKeys: Set<string>;
  onResolveError: (errorRecordId: string, leadId: string) => void;
  resolvingKeys: Set<string>;
}) {
  useEffect(() => {
    if (!lead) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lead, onClose]);

  const open = Boolean(lead);
  const currentStage = lead ? stages[lead.currentStage] : null;

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`}>
        {lead && (
          <>
            <div className="drawer-head">
              <div className="drawer-head-l">
                <span className="eyebrow">
                  {lead.id.slice(0, 10)} · {lead.city}
                </span>
                <h2>{lead.company}</h2>
                <span className="drawer-email">{lead.name} · {lead.email}</span>
              </div>
              <button
                className="icon-btn"
                style={{ color: "var(--fg-2)", borderColor: "var(--ma-line)" }}
                onClick={onClose}
                aria-label="Close"
              >
                <Icon.X />
              </button>
            </div>

            <div className="drawer-body">
              {lead.status === "error" && lead.statusError && currentStage && (
                <div className="callout callout--red" style={{ marginBottom: 20 }}>
                  <Icon.Alert size={16} />
                  <div>
                    <b>Stuck at {currentStage.title}.</b> {lead.statusError.msg}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                      {lead.statusError.code}
                      {lead.statusError.node ? ` · node: ${lead.statusError.node}` : ""}
                      {lead.statusError.executionId ? ` · exec #${lead.statusError.executionId}` : ""}
                    </div>
                  </div>
                </div>
              )}
              {lead.status === "done" && (
                <div className="callout callout--green" style={{ marginBottom: 20 }}>
                  <Icon.Check size={16} />
                  <div>
                    <b>Client is live.</b> Close CRM closed · email validated · Airtable records created · Mighty Networks invited · Intercom synced · VendHub activated.
                  </div>
                </div>
              )}
              {lead.status === "processing" && currentStage && (
                <div className="callout callout--gold" style={{ marginBottom: 20 }}>
                  <Icon.Activity size={16} />
                  <div>
                    <b>Onboarding in progress</b> — currently at {currentStage.title}.
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h4>Client details</h4>
                <dl className="kv">
                  <dt>REP</dt>
                  <dd>{lead.realSalesRep || "Unassigned"}</dd>
                  <dt>Program tier</dt>
                  <dd>{lead._programTier || "—"}</dd>
                  <dt>Signed up</dt>
                  <dd>{lead.createdAt}</dd>
                  <dt>Email</dt>
                  <dd>
                    {lead.email && lead.email !== "—" ? (
                      <a href={`mailto:${lead.email}`} style={{ fontSize: 12, color: "var(--info)" }}>
                        {lead.email}
                      </a>
                    ) : (
                      <span style={{ color: "var(--err)" }}>— (missing on Close lead)</span>
                    )}
                  </dd>
                </dl>
              </div>

              <div className="drawer-section">
                <h4>Open in platform</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {/* Close CRM — direct link when we have lead_xxx id */}
                  {(() => {
                    const link = closeLink(lead._closeLeadId || lead._clientId);
                    return link ? (
                      <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer" title={link.externalId}>
                        <Icon.External size={11} /> Close CRM
                      </a>
                    ) : (
                      <span className="btn btn--ghost btn--xs" style={{ opacity: 0.4, pointerEvents: "none" }} title="No Close lead_* id on record">
                        Close CRM — not linked
                      </span>
                    );
                  })()}
                  {/* Airtable Clients record */}
                  {(() => {
                    const link = airtableLink(lead._airtableRecordId || lead.id);
                    return link ? (
                      <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer">
                        <Icon.External size={11} /> Airtable
                      </a>
                    ) : null;
                  })()}
                  {/* Mighty Networks — direct link when we have member id */}
                  {(() => {
                    const link = mightyLink(lead._mnMemberId);
                    if (link) {
                      return (
                        <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer" title={`MN member #${link.externalId}`}>
                          <Icon.External size={11} /> Mighty Networks
                        </a>
                      );
                    }
                    return (
                      <span className="btn btn--ghost btn--xs" style={{ opacity: 0.4, pointerEvents: "none" }}>
                        Mighty Networks — not imported
                      </span>
                    );
                  })()}
                  {/* Intercom — direct link when we have contact id */}
                  {(() => {
                    const link = intercomLink(lead._intercomContactId);
                    if (link) {
                      return (
                        <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer" title={`Intercom contact ${link.externalId}`}>
                          <Icon.External size={11} /> Intercom
                        </a>
                      );
                    }
                    return lead.email && lead.email !== "—" ? (
                      <a
                        className="btn btn--ghost btn--xs"
                        href={`https://app.intercom.com/a/apps/_/users/search?query=${encodeURIComponent(lead.email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Not yet verified — search Intercom by email"
                      >
                        <Icon.External size={11} /> Intercom (search)
                      </a>
                    ) : (
                      <span className="btn btn--ghost btn--xs" style={{ opacity: 0.4, pointerEvents: "none" }}>Intercom — not imported</span>
                    );
                  })()}
                  {/* VendHub — direct user/org link when we have either */}
                  {(() => {
                    const link = vendhubLink(lead._vendHubUserId, lead._vendHubOrganization);
                    return link ? (
                      <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer" title={link.externalId}>
                        <Icon.External size={11} /> VendHub
                      </a>
                    ) : (
                      <span className="btn btn--ghost btn--xs" style={{ opacity: 0.4, pointerEvents: "none" }}>VendHub — not yet activated</span>
                    );
                  })()}
                  {/* Email */}
                  {(() => {
                    const link = emailLink(lead.email && lead.email !== "—" ? lead.email : undefined);
                    return link ? (
                      <a className="btn btn--ghost btn--xs" href={link.url} target="_blank" rel="noopener noreferrer">
                        <Icon.External size={11} /> Email
                      </a>
                    ) : null;
                  })()}
                  {/* n8n — filter executions by lead id */}
                  {lead._clientId && (
                    <a
                      className="btn btn--ghost btn--xs"
                      href={`https://n8n.aimanagingservices.com/executions?filter=%7B%22search%22%3A%22${encodeURIComponent(lead._clientId)}%22%7D`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Find n8n executions involving this lead"
                    >
                      <Icon.External size={11} /> n8n executions
                    </a>
                  )}
                </div>
                {lead._clientId && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    Close lead: {lead._clientId}
                    {lead._mnInviteId && ` · MN invite #${lead._mnInviteId}`}
                    {lead._vendHubUserId && ` · VendHub user ${lead._vendHubUserId}`}
                  </div>
                )}
              </div>

              <div className="drawer-section">
                <h4>Onboarding journey</h4>
                <div className="journey">
                  {lead.timeline.map((t, i) => {
                    const s = stages[i];
                    const Logo = PlatformLogos[s.platform];
                    const retryKey = `${lead.id}-${i}`;
                    const retrying = retryingKeys.has(retryKey);
                    const canRetry = t.status === "error" && s.stepId !== "vendhub";
                    return (
                      <div key={s.id} className="journey-step">
                        <div className={`journey-icon ${t.status}`}>
                          {t.status === "done" ? (
                            <Icon.Check size={16} />
                          ) : t.status === "error" ? (
                            <Icon.Alert size={16} />
                          ) : t.status === "current" ? (
                            <Icon.Loader size={16} className="spin-slow" />
                          ) : (
                            <Logo size={18} mono />
                          )}
                        </div>
                        <div>
                          <div className="journey-body-name">{s.title}</div>
                          <div className="journey-body-meta">
                            {t.status === "done" && `Completed${t.at ? ` · ${t.at}` : ""}`}
                            {t.status === "current" && `In progress${t.at ? ` · ${t.at}` : ""}`}
                            {t.status === "error" && `Failed${t.at ? ` · ${t.at}` : ""}`}
                            {t.status === "pending" && "Waiting"}
                          </div>
                          {t.status === "error" && t.error && (
                            <>
                              <div className="journey-body-error">
                                <b>{t.error.code}</b>: {t.error.msg}
                                {t.error.node && (
                                  <>
                                    <br />
                                    <span style={{ opacity: 0.75 }}>node: {t.error.node}</span>
                                  </>
                                )}
                                {t.error.executionId && (
                                  <>
                                    {" · "}
                                    <a
                                      style={{ color: "var(--err)", textDecoration: "underline" }}
                                      href={`https://n8n.aimanagingservices.com/workflow/executions/${t.error.executionId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      exec #{t.error.executionId}
                                    </a>
                                  </>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                {canRetry && (
                                  <button
                                    className="btn btn--dark btn--xs"
                                    onClick={() => { if (!retrying) onRetry(lead, i); }}
                                    disabled={retrying}
                                  >
                                    {retrying
                                      ? (<><Icon.Loader size={11} className="spin-slow" /> Retrying…</>)
                                      : (<><Icon.Refresh size={11} /> Retry {s.title}</>)}
                                  </button>
                                )}
                                {t.error?.errorRecordId && (
                                  <button
                                    className="btn btn--ghost btn--xs"
                                    disabled={resolvingKeys.has(t.error.errorRecordId)}
                                    onClick={() => {
                                      if (t.error?.errorRecordId) onResolveError(t.error.errorRecordId, lead.id);
                                    }}
                                    title="Mark this error as resolved in Airtable"
                                  >
                                    {resolvingKeys.has(t.error.errorRecordId)
                                      ? (<><Icon.Loader size={11} className="spin-slow" /> Resolving…</>)
                                      : (<><Icon.Check size={11} /> Mark resolved</>)}
                                  </button>
                                )}
                                <a
                                  className="btn btn--ghost btn--xs"
                                  href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${lead.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Icon.External size={11} /> Open Airtable
                                </a>
                              </div>
                            </>
                          )}
                        </div>
                        <span className={`journey-status ${t.status}`}>{t.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="drawer-foot">
              <button className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard.writeText(lead.id)}>
                <Icon.Copy size={13} /> Copy record ID
              </button>
              {lead._clientId && (
                <a
                  className="btn btn--ghost btn--sm"
                  href={`https://app.close.com/lead/${lead._clientId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon.External size={13} /> Open in Close
                </a>
              )}
              {lead.status === "error" && (
                <button
                  className="btn btn--dark btn--sm"
                  onClick={() => onRetry(lead, lead.currentStage)}
                >
                  <Icon.Refresh size={13} /> Retry current step
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
