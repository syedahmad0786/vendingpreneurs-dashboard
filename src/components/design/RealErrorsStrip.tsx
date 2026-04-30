"use client";

/**
 * Real-errors strip — embedded between the Integrations Rail and the
 * Kanban/Table on the Pipeline page. Lists every lead with an open row
 * in the Onboarding Errors table (Status = "New" / "Investigating").
 *
 * These are the REAL errors — events emitted by the n8n
 * `New Student Onboarding (with Mighty Networks)` workflow when a
 * step blew up. They are NOT the "platform missing" errors the
 * stage-classifier flags (those are gaps, not failures).
 *
 * Each row has a Resubmit button that fires the existing all-platforms
 * n8n webhook (the same one the Airtable Resubmit Onboarding button uses)
 * and auto-marks the error row as Resolved on success.
 */

import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import type { DesignLead } from "@/lib/design-adapter";

interface Toast { type: "success" | "error" | "info"; text: string }

export function RealErrorsStrip({
  leads,
  onSelect,
  onToast,
  onAfterChange,
}: {
  leads: DesignLead[];
  onSelect: (l: DesignLead) => void;
  onToast: (t: Toast) => void;
  onAfterChange?: () => void;
}) {
  // A "real error" is any lead whose timeline has at least one stage in
  // status="error" backed by a real Onboarding Errors record id. The
  // stage classifier's "missing from a platform" checks have status=error
  // too, but no errorRecordId — so they're filtered out here.
  const realErrors = useMemo(() => {
    return leads
      .map((l) => {
        const errStep = l.timeline.find(
          (t) => t.status === "error" && Boolean(l.statusError?.errorRecordId)
        );
        if (!errStep || !l.statusError?.errorRecordId) return null;
        return { lead: l, errorRecordId: l.statusError.errorRecordId };
      })
      .filter((x): x is { lead: DesignLead; errorRecordId: string } => Boolean(x));
  }, [leads]);

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const handleResubmit = async (lead: DesignLead, errorRecordId: string) => {
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

  // Hide the strip when there's nothing to show — keeps the page tidy.
  if (realErrors.length === 0) return null;

  return (
    <section
      className="real-errors-strip"
      aria-label="Real workflow errors"
      style={{
        margin: "16px 0",
        padding: "14px 16px",
        background: "linear-gradient(180deg, rgba(220, 38, 38, 0.08), rgba(220, 38, 38, 0.03))",
        border: "1px solid rgba(220, 38, 38, 0.25)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: collapsed ? 0 : 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(220, 38, 38, 0.18)",
              color: "var(--err)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon.Alert size={15} />
          </span>
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--err)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              Real workflow errors · from n8n
            </div>
            <div style={{ fontWeight: 700, color: "var(--fg-1)", fontSize: 16 }}>
              {realErrors.length} {realErrors.length === 1 ? "lead" : "leads"} need a resubmit
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2, maxWidth: 720 }}>
              Open rows from the <strong>Onboarding Errors</strong> Airtable table — failures from the{" "}
              <em>New Student Onboarding (with Mighty Networks)</em> n8n workflow. Resubmit reruns the full
              pipeline and auto-resolves the error row on success.
            </div>
          </div>
        </div>
        <button
          className="btn btn--ghost btn--xs"
          onClick={() => setCollapsed((v) => !v)}
          style={{ flexShrink: 0 }}
        >
          {collapsed ? `Show all ${realErrors.length}` : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <div
          className="real-errors-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 360,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {realErrors.map(({ lead, errorRecordId }) => {
            const errStep = lead.timeline.find(
              (t) => t.status === "error" && Boolean(lead.statusError?.errorRecordId)
            );
            const isBusy = busy.has(errorRecordId);
            return (
              <div
                key={errorRecordId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1.7fr 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "var(--ma-surface)",
                  border: "1px solid var(--ma-line)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "var(--fg-1)" }}>
                    {lead.name || "(no name)"}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                    {lead.email || "(no email)"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "1px 8px",
                      borderRadius: 4,
                      background: "rgba(220, 38, 38, 0.10)",
                      color: "var(--err)",
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    {errStep?.stage?.toUpperCase().replace(/_/g, " ") || "ERROR"}
                  </div>
                  <div style={{ color: "var(--fg-2)", fontSize: 11, lineHeight: 1.4 }}>
                    {lead.statusError?.code || "Error"} ·{" "}
                    {lead.statusError?.msg || "(no message)"}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{lead.createdAt}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    className="btn btn--ghost btn--xs"
                    onClick={() => onSelect(lead)}
                  >
                    Details
                  </button>
                  <button
                    className="btn btn--primary btn--xs"
                    disabled={isBusy}
                    onClick={() => handleResubmit(lead, errorRecordId)}
                    title="Re-run full onboarding pipeline via n8n"
                  >
                    {isBusy ? (
                      <>
                        <Icon.Loader size={11} className="spin-slow" /> Resubmitting…
                      </>
                    ) : (
                      <>
                        <Icon.Refresh size={11} /> Resubmit
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
