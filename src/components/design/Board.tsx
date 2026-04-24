"use client";

import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";

function LeadCard({
  lead,
  stageIdx,
  onClick,
  onRetry,
  retrying,
}: {
  lead: DesignLead;
  stageIdx: number;
  onClick: () => void;
  onRetry: (lead: DesignLead, stageIdx: number) => void;
  retrying: boolean;
}) {
  const cls =
    lead.status === "error"   ? "error" :
    lead.status === "done"    ? "success" :
    lead.status === "waiting" ? "waiting" :
    "processing";

  // Build the "waiting on" label from the per-platform flags
  const waitingOn: string[] = [];
  if (lead.waitingOnMN) waitingOn.push("MN");
  if (lead.waitingOnVendhub) waitingOn.push("VendHub");
  if (lead.waitingOnIntercom) waitingOn.push("Intercom");

  return (
    <div className={`lead-card ${cls}`} onClick={onClick}>
      <div className="lead-card-top">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="lead-name">{lead.company}</div>
          <div className="lead-email">{lead.email}</div>
        </div>
        {lead.status === "error" && <span className="lead-tag tag-error">Error</span>}
        {lead.status === "waiting" && <span className="lead-tag tag-waiting">Waiting</span>}
        {lead.status === "processing" && <span className="lead-tag tag-processing">Live</span>}
        {lead.status === "done" && <span className="lead-tag tag-success">Done</span>}
      </div>

      <div className="lead-meta">
        <span>{lead.city}</span>
        <span className="dot" />
        <span>{lead.id.slice(0, 10)}</span>
      </div>

      <div className="lead-progress">
        {lead.timeline.map((t, i) => (
          <span key={i} className={`step ${t.status}`} />
        ))}
      </div>

      {lead.status === "error" && lead.statusError && (
        <div className="error-msg">
          <b>{lead.statusError.code}</b> · {lead.statusError.msg}
        </div>
      )}

      {lead.status === "waiting" && waitingOn.length > 0 && (
        <div className="waiting-msg" style={{
          fontSize: 11,
          color: "var(--fg-2)",
          padding: "4px 8px",
          background: "rgba(37, 99, 235, 0.08)",
          borderRadius: 4,
          marginTop: 6,
          display: "inline-block",
        }}>
          Waiting on <b>{waitingOn.join(" + ")}</b>
        </div>
      )}

      <div className="lead-footer">
        <div className="lead-footer-l">
          <span className="mini-avatar">{lead.owner}</span>
          <Icon.Clock /> {lead.timeline[stageIdx]?.at || lead.createdAt}
        </div>
        {lead.status === "error" && (
          <button
            className={`retry-btn ${retrying ? "retrying" : ""}`}
            disabled={retrying}
            onClick={(e) => {
              e.stopPropagation();
              if (!retrying) onRetry(lead, stageIdx);
            }}
          >
            {retrying
              ? (<><Icon.Loader size={12} /> Retrying…</>)
              : (<><Icon.Refresh size={12} /> Retry</>)}
          </button>
        )}
        {lead.status === "processing" && (
          <span style={{ fontSize: 11, color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ma-gold)", animation: "pulse 1.4s ease-in-out infinite" }} />
            Live
          </span>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({
  stages,
  leadsByStage,
  onCardClick,
  onRetry,
  retryingKeys,
}: {
  stages: DesignStage[];
  leadsByStage: Record<string, DesignLead[]>;
  onCardClick: (lead: DesignLead) => void;
  onRetry: (lead: DesignLead, stageIdx: number) => void;
  retryingKeys: Set<string>;
}) {
  return (
    <div className="board">
      {stages.map((s, i) => {
        const Logo = PlatformLogos[s.platform];
        const leads = leadsByStage[s.id] ?? [];
        const errorCount = leads.filter((l) => l.status === "error").length;
        return (
          <div key={s.id} className="col">
            <div className="col-head">
              <div className="col-head-l">
                <span className="col-platform-logo"><Logo size={18} /></span>
                <div className="col-title">
                  <span className="stage-num">Stage {s.num}</span>
                  {s.title}
                </div>
              </div>
              <span className={`col-count ${errorCount ? "has-errors" : ""}`} title={errorCount ? `${leads.length} at stage · ${errorCount} in error` : `${leads.length} at stage`}>
                {leads.length}
                {errorCount > 0 && (
                  <span style={{ marginLeft: 6, fontSize: "0.75em", opacity: 0.85 }}>
                    · {errorCount} err
                  </span>
                )}
              </span>
            </div>
            <div className="col-body">
              {leads.length === 0 ? (
                <div
                  style={{
                    padding: "24px 12px",
                    textAlign: "center",
                    color: "var(--fg-3)",
                    fontSize: 12,
                    border: "1px dashed var(--ma-line)",
                    borderRadius: 6,
                  }}
                >
                  No clients at this stage
                </div>
              ) : (
                leads.map((lead) => {
                  const retryKey = `${lead.id}-${i}`;
                  return (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      stageIdx={i}
                      onClick={() => onCardClick(lead)}
                      onRetry={onRetry}
                      retrying={retryingKeys.has(retryKey)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
