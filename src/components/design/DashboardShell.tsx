"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";

/* ───────── TopBar ───────── */

export function TopBar({
  activeNav,
  setActiveNav,
  dark,
  setDark,
  search,
  setSearch,
}: {
  activeNav: string;
  setActiveNav: (id: string) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const items: [string, string][] = [
    ["pipeline", "Pipeline"],
    ["operators", "Clients"],
    ["errors", "Errors & retries"],
    ["cross-platform", "Cross-platform"],
    ["analytics", "Analytics"],
  ];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-logo">
          <Image
            src="/brand/modern-amenities-icon.png"
            alt="Modern Amenities"
            width={110}
            height={66}
            priority
            style={{ display: "block", height: 44, width: "auto", flexShrink: 0 }}
          />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, marginLeft: 14 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, letterSpacing: "0.09em", color: "#fff", textTransform: "uppercase" }}>
              Modern Amenities
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "#c9a91f", letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase" }}>
              Vendingpreneurs · Onboarding
            </span>
          </span>
        </div>

        <nav className="topnav">
          {items.map(([id, label]) => (
            <a
              key={id}
              className={activeNav === id ? "active" : ""}
              onClick={() => setActiveNav(id)}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="topbar-spacer" />

        <div className="topbar-right">
          <div className="search">
            <Icon.Search size={14} />
            <input
              placeholder="Search clients, emails, IDs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌘K</kbd>
          </div>
          <button className="icon-btn" onClick={() => setDark(!dark)} title="Theme">
            {dark ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
          </button>
          <button className="icon-btn has-dot" title="Notifications">
            <Icon.Bell size={16} />
          </button>
          <button className="icon-btn" title="Help">
            <Icon.Help size={16} />
          </button>
          <div className="avatar">MA</div>
        </div>
      </div>
    </header>
  );
}

/* ───────── SubBar ───────── */

export function SubBar({
  owner,
  setOwner,
  owners,
  onRefresh,
  refreshing,
}: {
  owner: string;
  setOwner: (v: string) => void;
  owners: { value: string; label: string; count?: number }[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="subbar">
      <div className="subbar-inner">
        <div className="page-title">
          <span className="eyebrow">Operations · Onboarding</span>
          <h1>Onboarding pipeline</h1>
        </div>
        <div className="page-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>REP</span>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={{
                background: "var(--ma-surface)",
                border: "1px solid var(--ma-line)",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 12,
                color: "var(--fg-1)",
                minWidth: 220,
                cursor: "pointer",
              }}
            >
              {owners.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.count !== undefined ? `  (${o.count})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onRefresh} disabled={refreshing}>
            <Icon.Refresh size={14} className={refreshing ? "spin-slow" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn btn--ghost btn--sm">
            <Icon.Download size={14} /> Export
          </button>
          <button className="btn btn--primary btn--sm">
            <Icon.Plus /> Add client
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── KPI Strip ───────── */

export interface WaitingBreakdown {
  total: number;
  mightyNetworks: number;
  intercom: number;
  vendhub: number;
}

export function KPIStrip({
  total,
  inFlight,
  stuck,
  live,
  waiting,
}: {
  total: number;
  inFlight: number;
  stuck: number;
  live: number;
  waiting?: WaitingBreakdown;
}) {
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <span className="kpi-label">Leads in flight</span>
        <span className="kpi-value">{inFlight}</span>
        <span className="kpi-delta up">▲ live pipeline</span>
      </div>
      <div className={`kpi ${stuck ? "kpi--alert" : ""}`}>
        <span className="kpi-label">Stuck on error</span>
        <span className="kpi-value">
          {stuck} <span className="unit">leads</span>
        </span>
        <span className="kpi-delta down">Needs attention</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Clients live</span>
        <span className="kpi-value">{live}</span>
        <span className="kpi-delta up">All steps complete</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Tracked leads</span>
        <span className="kpi-value">
          {total} <span className="unit">total</span>
        </span>
        <span className="kpi-delta">Across all owners</span>
      </div>
      <div className="kpi kpi--waiting">
        <span className="kpi-label">Waiting for customer</span>
        <span className="kpi-value">{waiting?.total ?? 0}</span>
        <span
          className="kpi-delta"
          style={{ fontSize: 11, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <span title="Mighty Networks invite sent, lead hasn't joined">
            MN <b>{waiting?.mightyNetworks ?? 0}</b>
          </span>
          <span title="VendHub: staged, lead hasn't signed up">
            VendHub <b>{waiting?.vendhub ?? 0}</b>
          </span>
          <span title="Intercom: sync sent, lead hasn't confirmed">
            Intercom <b>{waiting?.intercom ?? 0}</b>
          </span>
        </span>
      </div>
    </div>
  );
}

/* Helper: clickable mini-stat with hover tooltip listing matching leads. */
function DrillStat({
  count,
  label,
  tooltip,
  leads,
  onClick,
  color,
}: {
  count: number;
  label: string;
  tooltip: string;
  leads?: DesignLead[];
  onClick?: () => void;
  color?: string;
}) {
  const clickable = count > 0 && onClick;
  const preview = leads?.slice(0, 8).map((l) => l.company).join("\n") || "";
  const extra = (leads?.length || 0) > 8 ? `\n…and ${leads!.length - 8} more` : "";
  const fullTooltip = clickable
    ? `${tooltip}\nClick to filter board.\n\n${preview}${extra}`
    : tooltip;
  return (
    <span
      title={fullTooltip}
      onClick={clickable ? onClick : undefined}
      style={{
        cursor: clickable ? "pointer" : "default",
        color,
        textDecoration: clickable ? "underline dotted" : "none",
        textUnderlineOffset: 3,
      }}
    >
      <b>{count}</b> {label}
    </span>
  );
}

/* ───────── Integrations Rail ───────── */

export interface StepSummary { success: number; error: number; pending: number; waiting?: number }

export interface StageLeadLists {
  success: DesignLead[];
  error: DesignLead[];
  waiting: DesignLead[];
  pending: DesignLead[];
}

export function IntegrationsRail({
  stages,
  byStep,
  leadLists,
  onDrill,
  updatedAt,
}: {
  stages: DesignStage[];
  /** Authoritative per-step counts from /api/onboarding/pipeline summary.byStep */
  byStep?: Record<string, StepSummary>;
  /**
   * Per-stage lead lists grouped by bucket — used for hover tooltips and
   * the click-to-drill filter. Keyed by stepId.
   */
  leadLists?: Record<string, StageLeadLists>;
  /**
   * Called when the user clicks a stat. The dashboard applies a filter that
   * narrows the board to the exact set of leads clicked on.
   */
  onDrill?: (stageId: string, bucket: "success" | "error" | "waiting" | "pending") => void;
  updatedAt?: string;
}) {
  return (
    <div className="integrations-rail">
      <div className="rail-head">
        <h3>Pipeline stages · live status</h3>
        <span className="rail-sub">
          {updatedAt ? `Last check · ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Last check · just now"} · auto-refreshing · click any number to filter
        </span>
      </div>
      <div className="rail-grid">
        {stages.map((s) => {
          const Logo = PlatformLogos[s.platform];
          const c = byStep?.[s.stepId] || { success: 0, error: 0, pending: 0, waiting: 0 };
          const waiting = c.waiting || 0;
          const status: "ok" | "warn" | "err" = c.error > 1 ? "err" : c.error === 1 ? "warn" : "ok";
          return (
            <div key={s.id} className="rail-cell">
              <div className="rail-cell-top">
                <span className="rail-platform-logo"><Logo size={18} /></span>
                <div>
                  <div className="rail-platform-name">{s.title}</div>
                  <div className="rail-platform-role">{s.role}</div>
                </div>
              </div>
              <div className="rail-status">
                <span className={`status-dot ${status === "ok" ? "" : status}`} />
                {status === "ok" && "Operational"}
                {status === "warn" && "1 error — investigating"}
                {status === "err" && `${c.error} errors detected`}
              </div>
              <div className="rail-mini-stats">
                <DrillStat
                  count={c.success}
                  label="passed"
                  tooltip="Step completed successfully"
                  leads={leadLists?.[s.stepId]?.success}
                  onClick={() => onDrill?.(s.stepId, "success")}
                />
                <DrillStat
                  count={c.error}
                  label="failed"
                  tooltip="Real pipeline failure — ops must act"
                  leads={leadLists?.[s.stepId]?.error}
                  onClick={() => onDrill?.(s.stepId, "error")}
                  color={c.error > 0 ? "var(--err)" : undefined}
                />
                <DrillStat
                  count={waiting}
                  label="waiting"
                  tooltip="Invite / sync sent — waiting on customer to act"
                  leads={leadLists?.[s.stepId]?.waiting}
                  onClick={() => onDrill?.(s.stepId, "waiting")}
                  color={waiting > 0 ? "#2563eb" : undefined}
                />
                <DrillStat
                  count={c.pending}
                  label="pending"
                  tooltip="Not yet reached this step"
                  leads={leadLists?.[s.stepId]?.pending}
                  onClick={() => onDrill?.(s.stepId, "pending")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Board Toolbar ───────── */

export type SortKey =
  | "createdDesc"  // newest first
  | "createdAsc"   // oldest first
  | "stageDesc"    // furthest along
  | "stageAsc"     // earliest stage
  | "status"       // errors → waiting → in flight → live
  | "owner";       // alphabetical by sales rep

export function BoardToolbar({
  filter,
  setFilter,
  counts,
  sort,
  setSort,
}: {
  filter: string;
  setFilter: (v: string) => void;
  counts: { total: number; inFlight: number; stuck: number; live: number; waiting: number };
  sort: SortKey;
  setSort: (v: SortKey) => void;
}) {
  return (
    <div className="board-toolbar">
      <div className="board-filters">
        <span
          className="chip"
          style={{
            background: "transparent",
            border: 0,
            padding: "6px 4px",
            cursor: "default",
            color: "var(--fg-3)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
          }}
        >
          Filter
        </span>
        <Chip label="All" count={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <Chip label="In flight" count={counts.inFlight} active={filter === "processing"} onClick={() => setFilter("processing")} />
        <Chip label="Waiting on customer" count={counts.waiting} active={filter === "waiting"} onClick={() => setFilter("waiting")} />
        <Chip label="Errors" count={counts.stuck} active={filter === "errors"} onClick={() => setFilter("errors")} />
        <Chip label="Live" count={counts.live} active={filter === "done"} onClick={() => setFilter("done")} />
      </div>
      <div className="board-filters" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon.Sort size={13} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            background: "var(--ma-surface)",
            border: "1px solid var(--ma-line)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            color: "var(--fg-1)",
            cursor: "pointer",
          }}
        >
          <option value="createdDesc">Newest first</option>
          <option value="createdAsc">Oldest first</option>
          <option value="stageDesc">Furthest along</option>
          <option value="stageAsc">Earliest stage</option>
          <option value="status">By status</option>
          <option value="owner">By REP</option>
        </select>
      </div>
    </div>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <span className={`chip ${active ? "active" : ""}`} onClick={onClick}>
      {label} <span className="count">{count}</span>
    </span>
  );
}

/* ───────── Toasts ───────── */

export interface Toast { id: number; type: "success" | "error" | "info"; text: string }

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? <Icon.Check size={14} /> : t.type === "error" ? <Icon.Alert size={14} /> : <Icon.Activity size={14} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// Unused-suppressor so tree-shake keeps the hook
export const _useStateAlias = useState;
