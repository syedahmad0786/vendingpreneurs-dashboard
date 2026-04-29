"use client";

/**
 * "New Errors" view — dedicated section for ghost-lead errors that fired
 * BEFORE the lead made it into the Clients table. Each row carries a
 * Resubmit button that fires the all-platforms n8n resubmit workflow
 * (the same one wired to the Airtable Resubmit Onboarding button).
 */

import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";

interface Toast { type: "success" | "error" | "info"; text: string }

export function NewErrorsView({
  leads,
  stages,
  onSelect,
  onToast,
  onAfterChange,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  onSelect: (l: DesignLead) => void;
  onToast: (t: Toast) => void;
  /** Called after a successful resubmit so the parent can refetch. */
  onAfterChange?: () => void;
}) {
  // Ghost leads = activeStatus="new_waiting" + status="error" + no platform IDs.
  // These are the rows that exist only in the Onboarding Errors table — pre-Client
  // failures that need to be retried through the full pipeline.
  const ghosts = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.status === "error" &&
          l.activeStatus === "new_waiting" &&
          !l._mnMemberId &&
          !l._intercomContactId &&
          !l._vendHubUserId
      ),
    [leads]
  );

  const [busy, setBusy] = useState<Set<string>>(new Set());

  const handleResubmit = async (lead: DesignLead) => {
    const errorRecordId = lead.statusError?.errorRecordId || lead._airtableRecordId || lead.id;
    if (busy.has(errorRecordId)) return;
    setBusy((prev) => new Set(prev).add(errorRecordId));
    try {
      const res = await fetch("/api/onboarding/resubmit-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          errorRecordId,
          email: lead.email && lead.email !== "—" ? lead.email : undefined,
          leadName: lead.name,
          leadId: lead._closeLeadId || lead._clientId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        onToast({ type: "error", text: `Resubmit failed: ${data.message || `HTTP ${res.status}`}` });
        return;
      }
      onToast({
        type: "success",
        text: `Resubmitted ${lead.name || lead.email} — n8n accepted, error marked Resolved`,
      });
      if (onAfterChange) setTimeout(onAfterChange, 1200);
    } catch (err) {
      onToast({ type: "error", text: `Resubmit failed: ${err instanceof Error ? err.message : "Unknown"}` });
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(errorRecordId);
        return next;
      });
    }
  };

  return (
    <div className="new-errors-view">
      <div className="view-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="eyebrow eyebrow--gold">New onboarding errors</span>
          <h2>{ghosts.length} pre-Client failures need attention</h2>
          <p style={{ fontSize: 13, color: "var(--fg-3)", maxWidth: 640, marginTop: 4 }}>
            These leads errored out before a Clients row was ever created (typically a Close → Airtable handoff
            failure). Resubmit fires the same all-platforms n8n workflow that the Airtable
            <strong> Resubmit Onboarding</strong> button triggers — and auto-resolves the error row on success.
          </p>
        </div>
      </div>

      {ghosts.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--fg-3)",
            border: "1px dashed var(--ma-line)",
            borderRadius: 8,
          }}
        >
          <Icon.Check size={24} />
          <div style={{ marginTop: 8, fontWeight: 600, color: "var(--fg-1)" }}>No pre-Client failures</div>
          <div style={{ fontSize: 13 }}>Every lead in the pipeline has a Clients row.</div>
        </div>
      ) : (
        <div className="error-list">
          {ghosts.map((l) => {
            const errStep = l.timeline.find((t) => t.status === "error");
            const stage = stages.find((s) => s.stepId === errStep?.stepId);
            const errorRecordId = l.statusError?.errorRecordId || l._airtableRecordId || l.id;
            const isBusy = busy.has(errorRecordId);
            return (
              <div key={l.id} className="error-row">
                <div className="error-row-l">
                  <span
                    className="error-row-logo"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "rgba(220, 38, 38, 0.10)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--err)",
                    }}
                  >
                    <Icon.Alert size={16} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg-1)" }}>{l.name || "(no name)"}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{l.email || "(no email)"}</div>
                  </div>
                </div>
                <div className="error-row-m">
                  <div className="error-code">{l.statusError?.code || "Unknown"}</div>
                  <div className="error-msg-inline">
                    {stage?.title ? `${stage.title} · ` : ""}
                    {l.statusError?.msg || "(no message)"}
                  </div>
                </div>
                <div className="error-row-r">
                  <span style={{ fontSize: 11, color: "var(--fg-3)", marginRight: 8 }}>
                    {l.createdAt}
                  </span>
                  <button className="btn btn--ghost btn--xs" onClick={() => onSelect(l)}>
                    Details
                  </button>
                  <button
                    className="btn btn--primary btn--xs"
                    disabled={isBusy}
                    onClick={() => handleResubmit(l)}
                    title="Re-run the entire onboarding pipeline for this lead via n8n"
                  >
                    {isBusy ? (
                      <>
                        <Icon.Loader size={11} className="spin-slow" /> Resubmitting…
                      </>
                    ) : (
                      <>
                        <Icon.Refresh size={11} /> Resubmit all platforms
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
