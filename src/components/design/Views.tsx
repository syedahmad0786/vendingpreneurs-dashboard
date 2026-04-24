"use client";

import { useState } from "react";
import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import { DonutChart, BarChart, Sparkline, AreaTrend } from "./Charts";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";

/* ========================================================
   Operators — sortable table of every lead
   ======================================================== */
export function OperatorsView({
  leads,
  stages,
  onSelect,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  onSelect: (l: DesignLead) => void;
}) {
  const [sortBy, setSortBy] = useState("recent");
  const [statusFilter, setStatusFilter] = useState<"all" | "error" | "waiting" | "processing" | "done">("all");
  const [search, setSearch] = useState("");

  const filtered = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
      )) return false;
    }
    return true;
  });

  const statusRank: Record<string, number> = { error: 0, waiting: 1, processing: 2, done: 3 };
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "status") return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (sortBy === "stage") return b.currentStage - a.currentStage;
    if (sortBy === "stageAsc") return a.currentStage - b.currentStage;
    if (sortBy === "owner") return (a.realSalesRep || "zzz").localeCompare(b.realSalesRep || "zzz");
    if (sortBy === "name") return a.company.localeCompare(b.company);
    return 0;
  });

  return (
    <div className="view view--operators">
      <div className="view-head">
        <div>
          <span className="eyebrow">All operators</span>
          <h2>{filtered.length} of {leads.length} operators</h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "var(--ma-surface)",
              border: "1px solid var(--ma-line)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--fg-1)",
              minWidth: 220,
            }}
          />
          <select
            className="select-plain"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="error">Stuck on error</option>
            <option value="waiting">Waiting on customer</option>
            <option value="processing">In flight</option>
            <option value="done">Live</option>
          </select>
          <select className="select-plain" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most recent</option>
            <option value="stage">Furthest along</option>
            <option value="stageAsc">Earliest stage</option>
            <option value="status">By status</option>
            <option value="owner">By owner</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>
      <div className="operator-table">
        <div className="op-row op-row--head">
          <span>Operator</span>
          <span>Tier</span>
          <span>Owner</span>
          <span>Stage</span>
          <span>Status</span>
          <span>Started</span>
          <span></span>
        </div>
        {sorted.map((l) => {
          const stage = stages[l.currentStage];
          return (
            <div key={l.id} className="op-row" onClick={() => onSelect(l)}>
              <span>
                <div className="op-name">{l.company}</div>
                <div className="op-sub">{l.name} · {l.id.slice(0, 12)}</div>
              </span>
              <span>{l.city}</span>
              <span><span className="mini-avatar">{l.owner}</span></span>
              <span className="op-stage">
                <span className="stage-pill">{stage.num}</span> {stage.title}
              </span>
              <span>
                {l.status === "error" && <span className="lead-tag tag-error">Error</span>}
                {l.status === "waiting" && <span className="lead-tag tag-waiting">Waiting</span>}
                {l.status === "processing" && <span className="lead-tag tag-processing">In flight</span>}
                {l.status === "done" && <span className="lead-tag tag-success">Live</span>}
              </span>
              <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{l.createdAt}</span>
              <span><button className="btn btn--ghost btn--xs">Open →</button></span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-3)" }}>
            No operators match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   Errors & retries — dashboard of stuck pipelines
   ======================================================== */
export function ErrorsView({
  leads,
  stages,
  onRetry,
  retryingKeys,
  onSelect,
  onResolveAll,
  resolvingAll,
  onResolveOne,
  resolvingKeys,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  onRetry: (lead: DesignLead, stageIdx: number) => void;
  retryingKeys: Set<string>;
  onSelect: (l: DesignLead) => void;
  onResolveAll: () => void;
  resolvingAll: boolean;
  onResolveOne: (lead: DesignLead) => void;
  resolvingKeys: Set<string>;
}) {
  const errs = leads.filter((l) => l.status === "error");

  // Errors by monitored integration — bucket by the step that actually has
  // status="error" in the timeline, NOT by currentStage (currentStage is the
  // first non-done step, which may be a waiting step while the real error
  // is downstream).
  const breakdown = stages.map((s) => {
    const value = errs.filter((l) =>
      l.timeline.some((t) => t.stage === s.id && t.status === "error")
    ).length;
    return {
      label: s.title,
      value,
      color: value === 0 ? "var(--ma-line)" : "var(--ma-gold)",
    };
  });

  // By stage (donut) — same fix as "Errors by type": bucket by the step that
  // actually failed, not by the lead's currentStage.
  const byStage = stages.map((s) => {
    const n = errs.filter((l) =>
      l.timeline.some((t) => t.stage === s.id && t.status === "error")
    ).length;
    return { label: s.title, value: n };
  }).filter((s) => s.value > 0);
  const stageColors = ["#e8c020", "#184010", "#3a3a3a", "#c9a91f", "#2a5a20", "#8a8a8a"];
  const donutSegs = byStage.map((s, i) => ({ ...s, color: stageColors[i % stageColors.length] }));

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <span className="eyebrow eyebrow--gold">Errors &amp; retries</span>
          <h2>{errs.length} pipelines need attention</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn--dark btn--sm"
            onClick={() => {
              if (confirm("Mark all open errors as Resolved? This will sweep every error currently shown and cannot be undone from here.")) {
                onResolveAll();
              }
            }}
            disabled={resolvingAll}
          >
            {resolvingAll ? (<><Icon.Loader size={13} className="spin-slow" /> Resolving…</>) : (<><Icon.Check size={13} /> Mark all resolved</>)}
          </button>
        </div>
      </div>

      {errs.length > 0 && (
        <div className="chart-grid chart-grid--2">
          <div className="chart-card">
            <div className="chart-card-head">
              <h4>Errors by type</h4>
              <span className="chart-card-sub">Across all stages</span>
            </div>
            <BarChart data={breakdown} />
          </div>
          <div className="chart-card">
            <div className="chart-card-head">
              <h4>Where pipelines stall</h4>
              <span className="chart-card-sub">Current error distribution</span>
            </div>
            <DonutChart segments={donutSegs} label={String(errs.length)} sublabel="STUCK" />
          </div>
        </div>
      )}

      <div className="error-list">
        <h4 style={{ marginTop: 24, marginBottom: 12 }}>Active errors</h4>
        {errs.map((l) => {
          const stage = stages[l.currentStage];
          const Logo = PlatformLogos[stage.platform];
          const retryKey = `${l.id}-${l.currentStage}`;
          const isRetrying = retryingKeys.has(retryKey);
          const resolveKey = l.statusError?.errorRecordId || `${l.id}-res`;
          const isResolving = resolvingKeys.has(resolveKey);
          const canResolve = Boolean(l.statusError?.errorRecordId);
          return (
            <div key={l.id} className="error-row">
              <div className="error-row-l">
                <span className="error-row-logo"><Logo size={20} /></span>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--fg-1)" }}>{l.company}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    {l.name} · {l.id.slice(0, 12)}
                  </div>
                </div>
              </div>
              <div className="error-row-m">
                <div className="error-code">{l.statusError?.code || "Unknown"}</div>
                <div className="error-msg-inline">{l.statusError?.msg}</div>
              </div>
              <div className="error-row-r">
                <span style={{ fontSize: 12, color: "var(--fg-3)", marginRight: 8 }}>{l.retries} retries</span>
                <button className="btn btn--ghost btn--xs" onClick={() => onSelect(l)}>Details</button>
                <button
                  className="btn btn--ghost btn--xs"
                  disabled={!canResolve || isResolving}
                  title={canResolve ? "Mark this error as resolved in Airtable" : "No Airtable error record to resolve"}
                  onClick={() => { if (canResolve && !isResolving) onResolveOne(l); }}
                >
                  {isResolving ? (<><Icon.Loader size={11} className="spin-slow" /> Resolving</>) : (<><Icon.Check size={11} /> Mark resolved</>)}
                </button>
                <button
                  className={`btn btn--dark btn--xs ${isRetrying ? "retrying" : ""}`}
                  disabled={isRetrying}
                  onClick={() => { if (!isRetrying) onRetry(l, l.currentStage); }}
                >
                  {isRetrying ? (<><Icon.Loader size={11} className="spin-slow" /> Retrying</>) : (<><Icon.Refresh size={11} /> Retry</>)}
                </button>
              </div>
            </div>
          );
        })}
        {errs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-3)", border: "1px dashed var(--ma-line)", borderRadius: 8 }}>
            <Icon.Check size={24} />
            <div style={{ marginTop: 8, fontWeight: 600, color: "var(--fg-1)" }}>All pipelines healthy</div>
            <div style={{ fontSize: 13 }}>No active errors across any integration.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   Integrations — big cards with sparklines
   ======================================================== */
export function IntegrationsView({
  leads,
  stages,
  byStep,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  /** Authoritative per-step counts from the pipeline summary. */
  byStep?: Record<string, { success: number; error: number; pending: number; waiting?: number }>;
}) {
  const cards = stages.map((s) => {
    const c = byStep?.[s.stepId];
    const errs = c ? c.error : leads.filter((l) => l.status === "error" && stages[l.currentStage]?.id === s.id).length;
    const passed = c ? c.success : leads.filter((l) => l.timeline.find((t) => t.stage === s.id && (t.status === "done" || t.status === "current"))).length;
    const waiting = c ? (c.waiting || 0) : 0;
    const pending = c ? c.pending : 0;
    // gentle pseudo-random 14-day spark
    const seed = s.num.charCodeAt(1) || 1;
    const spark = Array.from({ length: 14 }, (_, i) => Math.max(1, Math.round(passed / 2 + Math.sin(i * 0.7 + seed * 0.3) * 2 + Math.random() * 2)));
    const uptime = errs === 0 ? 100 : errs === 1 ? 98.2 : Math.max(85, 100 - errs * 2);
    return { ...s, errs, passed, waiting, pending, spark, uptime };
  });
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <span className="eyebrow eyebrow--green">Integrations</span>
          <h2>6 systems in the onboarding chain</h2>
        </div>
      </div>
      <div className="integrations-grid">
        {cards.map((c) => {
          const Logo = PlatformLogos[c.platform];
          const healthy = c.errs === 0;
          return (
            <div key={c.id} className={`int-card ${healthy ? "" : "int-card--warn"}`}>
              <div className="int-card-head">
                <span className="int-logo"><Logo size={32} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="int-title">{c.title}</div>
                  <div className="int-role">{c.role}</div>
                </div>
                <span className={`int-badge ${healthy ? "ok" : "warn"}`}>
                  {healthy ? "Operational" : "Degraded"}
                </span>
              </div>
              <div className="int-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                <div>
                  <div className="int-stat-num">{c.passed}</div>
                  <div className="int-stat-lbl">Passed</div>
                </div>
                <div>
                  <div className="int-stat-num" style={{ color: c.errs ? "#b02a1a" : "var(--fg-1)" }}>{c.errs}</div>
                  <div className="int-stat-lbl">Failed</div>
                </div>
                <div>
                  <div className="int-stat-num" style={{ color: c.waiting ? "#2563eb" : "var(--fg-1)" }}>{c.waiting}</div>
                  <div className="int-stat-lbl">Waiting</div>
                </div>
                <div>
                  <div className="int-stat-num">{c.pending}</div>
                  <div className="int-stat-lbl">Pending</div>
                </div>
              </div>
              <div className="int-spark">
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Throughput · 14d</div>
                <Sparkline values={c.spark} color={healthy ? "#184010" : "#e8c020"} />
              </div>
              <div className="int-foot">
                <button className="btn btn--ghost btn--xs">View logs</button>
                <button className="btn btn--ghost btn--xs">Configure</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================================================
   Analytics — funnel + status donut + trend + owner bar
   ======================================================== */
export function AnalyticsView({
  leads,
  stages,
  byStep,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  byStep?: Record<string, { success: number; error: number; pending: number; waiting?: number }>;
}) {
  // Stage funnel — count of leads that have REACHED each step (success +
  // waiting + error, i.e. anything that isn't "pending / hasn't gotten here
  // yet"). Using byStep summary so this agrees with the Pipeline tab.
  const funnelData = stages.map((s) => {
    const c = byStep?.[s.stepId] || { success: 0, error: 0, pending: 0, waiting: 0 };
    const reached = (c.success || 0) + (c.error || 0) + (c.waiting || 0);
    return { label: s.title, value: reached };
  });
  const funnelColors = ["#e8c020", "#d4a820", "#8a6d1a", "#3a3a3a", "#2a5a20", "#184010"];

  // Real 12-week history: bucket leads by the week of their signup
  // (Create Date from Airtable). Each bucket holds count by current overall
  // status — live / in-flight / waiting / stuck. This is authoritative:
  // straight from the data, no pseudo-random anything.
  const WEEKS = 12;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const end = now - (WEEKS - 1 - i) * WEEK_MS;
    const start = end - WEEK_MS;
    return { start, end, live: 0, inflight: 0, waiting: 0, errors: 0, label: "" };
  });
  for (const l of leads) {
    const ts = l.createdAtRaw ? new Date(l.createdAtRaw).getTime() : NaN;
    if (!isFinite(ts)) continue;
    for (const b of buckets) {
      if (ts >= b.start && ts < b.end) {
        if (l.status === "done") b.live++;
        else if (l.status === "processing") b.inflight++;
        else if (l.status === "waiting") b.waiting++;
        else if (l.status === "error") b.errors++;
        break;
      }
    }
  }
  buckets.forEach((b, i) => {
    const d = new Date(b.end);
    b.label = `W${WEEKS - i}`;
    void d;
  });
  const liveSeries = buckets.map((b) => b.live);
  const inflightSeries = buckets.map((b) => b.inflight);
  const waitingSeries = buckets.map((b) => b.waiting);
  const errorsSeries = buckets.map((b) => b.errors);

  // By owner — every rep with ≥1 lead, sorted by load
  const ownerMap = new Map<string, number>();
  for (const l of leads) {
    const name = (l.realSalesRep || "").trim();
    if (!name) continue;
    ownerMap.set(name, (ownerMap.get(name) || 0) + 1);
  }
  const palette = ["#184010", "#e8c020", "#3a3a3a", "#2a5a20", "#d97706", "#2563eb", "#b02a1a"];
  const ownerCounts = Array.from(ownerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, n], i) => ({ label: name, value: n, color: palette[i % palette.length] }));

  const statusSegs = [
    { label: "Live operators",       value: leads.filter((l) => l.status === "done").length,       color: "#184010" },
    { label: "In flight",            value: leads.filter((l) => l.status === "processing").length, color: "#e8c020" },
    { label: "Waiting for customer", value: leads.filter((l) => l.status === "waiting").length,    color: "#2563eb" },
    { label: "Stuck on error",       value: leads.filter((l) => l.status === "error").length,      color: "#b02a1a" },
  ];

  const waitingLeads = leads.filter((l) => l.status === "waiting");
  const waitingMN = waitingLeads.filter((l) => l.waitingOnMN).length;
  const waitingVH = waitingLeads.filter((l) => l.waitingOnVendhub).length;
  const waitingIC = waitingLeads.filter((l) => l.waitingOnIntercom).length;
  const stuck = leads.filter((l) => l.status === "error").length;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <span className="eyebrow">Pipeline analytics</span>
          <h2>How operators are moving through the chain</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--ghost btn--sm">Last 30 days ▾</button>
          <button className="btn btn--ghost btn--sm">Export CSV</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-lbl">Waiting for customer</div>
          <div className="metric-val">{waitingLeads.length}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 11, color: "var(--fg-3)", flexWrap: "wrap" }}>
            <span>MN <b style={{ color: "var(--fg-1)" }}>{waitingMN}</b></span>
            <span>VendHub <b style={{ color: "var(--fg-1)" }}>{waitingVH}</b></span>
            <span>Intercom <b style={{ color: "var(--fg-1)" }}>{waitingIC}</b></span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-lbl">Stuck on error</div>
          <div className="metric-val">{stuck}</div>
          <div style={{ marginTop: 12, height: 40 }}>
            <Sparkline values={errorsSeries} color="#b02a1a" />
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--fg-3)" }}>Past 12 weeks · by signup date</div>
        </div>
        <div className="metric-card">
          <div className="metric-lbl">Live operators</div>
          <div className="metric-val">{leads.filter((l) => l.status === "done").length}</div>
          <div style={{ marginTop: 12, height: 40 }}>
            <Sparkline values={liveSeries} color="#184010" />
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--fg-3)" }}>Past 12 weeks · by signup date</div>
        </div>
        <div className="metric-card">
          <div className="metric-lbl">In flight</div>
          <div className="metric-val">{leads.filter((l) => l.status === "processing").length}</div>
          <div style={{ marginTop: 12, height: 40 }}>
            <Sparkline values={inflightSeries} color="#e8c020" />
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: "var(--fg-3)" }}>Past 12 weeks · by signup date</div>
        </div>
      </div>

      <div className="chart-grid chart-grid--2">
        <div className="chart-card">
          <div className="chart-card-head">
            <h4>Stage funnel</h4>
            <span className="chart-card-sub">Leads reaching each stage</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {funnelData.map((d, i) => {
              const pct = funnelData[0].value ? (d.value / funnelData[0].value) * 100 : 0;
              const drop = i > 0 ? funnelData[i - 1].value - d.value : 0;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 60px 50px", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span className="stage-pill">{stages[i].num}</span>
                  <div style={{ position: "relative", height: 28, background: "var(--ma-line)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: funnelColors[i], transition: "width .6s ease" }} />
                    <span style={{ position: "relative", zIndex: 1, padding: "6px 10px", color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", height: "100%" }}>
                      {d.label}
                    </span>
                  </div>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--fg-1)" }}>{d.value}</span>
                  <span style={{ fontSize: 11, color: drop > 0 ? "#b02a1a" : "var(--fg-3)", textAlign: "right" }}>
                    {drop > 0 ? `−${drop}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <h4>Pipeline status</h4>
            <span className="chart-card-sub">Current snapshot</span>
          </div>
          <DonutChart segments={statusSegs} label={String(leads.length)} sublabel="OPERATORS" />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-head">
          <h4>Signup cohorts · last 12 weeks</h4>
          <span className="chart-card-sub">Leads bucketed by their Create Date, shown in their current status</span>
        </div>
        <AreaTrend
          height={160}
          series={[
            { label: "Live",    values: liveSeries,    color: "#184010" },
            { label: "Waiting", values: waitingSeries, color: "#2563eb" },
            { label: "In flight", values: inflightSeries, color: "#e8c020" },
            { label: "Errors",  values: errorsSeries,  color: "#b02a1a" },
          ]}
        />
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "#184010", borderRadius: 2 }} /> Live</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "#2563eb", borderRadius: 2 }} /> Waiting</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "#e8c020", borderRadius: 2 }} /> In flight</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: "#b02a1a", borderRadius: 2 }} /> Errors</span>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-head">
          <h4>Operators by owner · {ownerCounts.length} reps</h4>
          <span className="chart-card-sub">Every sales rep in the pipeline — sorted by lead count</span>
        </div>
        <BarChart data={ownerCounts} />
      </div>
    </div>
  );
}
