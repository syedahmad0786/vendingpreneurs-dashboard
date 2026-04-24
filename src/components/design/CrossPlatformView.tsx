"use client";

import { useEffect, useState } from "react";
import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import { DonutChart, BarChart } from "./Charts";

interface GapRow {
  id: string;
  email: string;
  full_name: string | null;
  close_lead_id: string | null;
  missing_close: boolean;
  missing_airtable: boolean;
  missing_mighty: boolean;
  missing_intercom: boolean;
  missing_vendhub: boolean;
  classification: string;
}

interface Buckets {
  total: number;
  fully_onboarded: number;
  airtable_orphan: number;
  intercom_orphan: number;
  mighty_orphan: number;
  vendhub_orphan: number;
  close_only_or_partial: number;
  missing_close: number;
  missing_airtable: number;
  missing_mighty: number;
  missing_intercom: number;
  missing_vendhub: number;
}

const BUCKET_DEFS: { key: string; label: string; tone: "ok" | "warn" | "err" }[] = [
  { key: "fully_onboarded",        label: "Fully onboarded (all 5)",        tone: "ok" },
  { key: "close_only_or_partial",  label: "Close + partial (missing one)",  tone: "warn" },
  { key: "airtable_orphan",        label: "Airtable orphan (no Close)",     tone: "err" },
  { key: "intercom_orphan",        label: "Intercom orphan (no Close)",     tone: "err" },
  { key: "mighty_orphan",          label: "Mighty orphan (no Close)",       tone: "err" },
  { key: "vendhub_orphan",         label: "VendHub orphan (no Close)",      tone: "err" },
  { key: "missing_close",          label: "Missing from Close",             tone: "warn" },
  { key: "missing_airtable",       label: "Missing from Airtable",          tone: "warn" },
  { key: "missing_mighty",         label: "Missing from Mighty",            tone: "warn" },
  { key: "missing_intercom",       label: "Missing from Intercom",          tone: "warn" },
  { key: "missing_vendhub",        label: "Missing from VendHub",           tone: "warn" },
];

export function CrossPlatformView() {
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [rows, setRows] = useState<GapRow[]>([]);
  const [bucket, setBucket] = useState<string>("airtable_orphan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    fetch(`/api/platforms/gaps?bucket=${encodeURIComponent(bucket)}&limit=500`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        if (aborted) return;
        setBuckets(body.buckets);
        setRows(body.rows);
      })
      .catch((err) => {
        if (!aborted) setError(err.message);
      })
      .finally(() => {
        if (!aborted) setLoading(false);
      });
    return () => { aborted = true; };
  }, [bucket]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.email || "").toLowerCase().includes(q) ||
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.close_lead_id || "").toLowerCase().includes(q);
  });

  const presentIcon = (present: boolean) =>
    present ? (
      <Icon.Check size={14} />
    ) : (
      <span style={{ color: "var(--err)", fontSize: 12, fontWeight: 700 }}>×</span>
    );

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <span className="eyebrow eyebrow--gold">Cross-platform truth</span>
          <h2>{buckets?.total ?? "…"} unique leads across Close, Airtable, Mighty, Intercom, VendHub</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Search email, name, Close id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "var(--ma-surface)",
              border: "1px solid var(--ma-line)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--fg-1)",
              minWidth: 240,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="callout callout--red" style={{ marginBottom: 16 }}>
          <Icon.Alert size={16} />
          <div><b>Supabase not reachable:</b> {error}</div>
        </div>
      )}

      {/* VISUAL SUMMARY — donut + missing-from bars + membership bars */}
      {buckets && (
        <>
          <div className="chart-grid chart-grid--2" style={{ marginBottom: 20 }}>
            <div className="chart-card">
              <div className="chart-card-head">
                <h4>Lead distribution</h4>
                <span className="chart-card-sub">{buckets.total} unique leads by how many platforms they&rsquo;re on</span>
              </div>
              <DonutChart
                label={String(buckets.total)}
                sublabel="LEADS"
                segments={[
                  { label: "Fully onboarded (all 5)",  value: buckets.fully_onboarded,       color: "#184010" },
                  { label: "Close + partial",          value: buckets.close_only_or_partial, color: "#e8c020" },
                  { label: "Airtable orphan",          value: buckets.airtable_orphan,       color: "#b02a1a" },
                  { label: "Intercom orphan",          value: buckets.intercom_orphan,       color: "#2563eb" },
                  { label: "Mighty orphan",            value: buckets.mighty_orphan,         color: "#8B5CF6" },
                  { label: "VendHub orphan",           value: buckets.vendhub_orphan,        color: "#ea580c" },
                ].filter((s) => s.value > 0)}
              />
            </div>
            <div className="chart-card">
              <div className="chart-card-head">
                <h4>Missing-from counts</h4>
                <span className="chart-card-sub">How many leads are absent from each platform</span>
              </div>
              <BarChart
                data={[
                  { label: "Missing Close CRM",    value: buckets.missing_close,    color: "#10b25a" },
                  { label: "Missing Airtable",     value: buckets.missing_airtable, color: "#b87333" },
                  { label: "Missing Mighty",       value: buckets.missing_mighty,   color: "#8B5CF6" },
                  { label: "Missing Intercom",     value: buckets.missing_intercom, color: "#2563eb" },
                  { label: "Missing VendHub",      value: buckets.missing_vendhub,  color: "#ea580c" },
                ]}
              />
            </div>
          </div>
          <div className="chart-card" style={{ marginBottom: 20 }}>
            <div className="chart-card-head">
              <h4>Platform membership coverage</h4>
              <span className="chart-card-sub">
                Proportion of your {buckets.total} leads present in each platform
              </span>
            </div>
            <BarChart
              data={[
                { label: "Close CRM",       value: buckets.total - buckets.missing_close,    color: "#10b25a" },
                { label: "Airtable",        value: buckets.total - buckets.missing_airtable, color: "#b87333" },
                { label: "Mighty Networks", value: buckets.total - buckets.missing_mighty,   color: "#8B5CF6" },
                { label: "Intercom",        value: buckets.total - buckets.missing_intercom, color: "#2563eb" },
                { label: "VendHub",         value: buckets.total - buckets.missing_vendhub,  color: "#ea580c" },
              ]}
              valueFmt={(v) => `${v} / ${buckets.total} (${Math.round((v / (buckets.total || 1)) * 100)}%)`}
            />
          </div>
        </>
      )}

      {/* Bucket chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {BUCKET_DEFS.map((b) => {
          const n = (buckets as unknown as Record<string, number>)?.[b.key] ?? 0;
          const active = bucket === b.key;
          const color = b.tone === "ok" ? "#184010" : b.tone === "err" ? "#b02a1a" : "#c9a91f";
          return (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className={active ? "chip active" : "chip"}
              style={{
                borderLeft: `3px solid ${color}`,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {b.label} <span className="count" style={{ marginLeft: 4 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="operator-table" style={{ marginTop: 8 }}>
        <div className="op-row op-row--head" style={{ gridTemplateColumns: "1fr 1fr 0.5fr repeat(5, 60px) 80px" }}>
          <span>Lead</span>
          <span>Email</span>
          <span>Close ID</span>
          {(() => {
            const Close = PlatformLogos.close;
            const Airtable = PlatformLogos.airtable;
            const Mighty = PlatformLogos.mighty;
            const Intercom = PlatformLogos.intercom;
            const Vendhub = PlatformLogos.vendhub;
            return (
              <>
                <span title="Close CRM"><Close size={14} /></span>
                <span title="Airtable"><Airtable size={14} /></span>
                <span title="Mighty Networks"><Mighty size={14} /></span>
                <span title="Intercom"><Intercom size={14} /></span>
                <span title="VendHub"><Vendhub size={14} /></span>
              </>
            );
          })()}
          <span>Bucket</span>
        </div>
        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--fg-3)" }}>Loading…</div>}
        {!loading && filtered.map((r) => (
          <div
            key={r.id}
            className="op-row"
            style={{ gridTemplateColumns: "1fr 1fr 0.5fr repeat(5, 60px) 80px" }}
          >
            <span>
              <div className="op-name">{r.full_name || "—"}</div>
              <div className="op-sub mono">{r.id.slice(0, 8)}</div>
            </span>
            <span className="mono" style={{ fontSize: 12 }}>{r.email}</span>
            <span className="mono" style={{ fontSize: 11, color: r.close_lead_id ? "var(--fg-2)" : "var(--err)" }}>
              {r.close_lead_id ? r.close_lead_id.slice(0, 20) : "—"}
            </span>
            <span style={{ textAlign: "center" }}>{presentIcon(!r.missing_close)}</span>
            <span style={{ textAlign: "center" }}>{presentIcon(!r.missing_airtable)}</span>
            <span style={{ textAlign: "center" }}>{presentIcon(!r.missing_mighty)}</span>
            <span style={{ textAlign: "center" }}>{presentIcon(!r.missing_intercom)}</span>
            <span style={{ textAlign: "center" }}>{presentIcon(!r.missing_vendhub)}</span>
            <span style={{ fontSize: 10, color: "var(--fg-3)" }}>{r.classification.replace(/_/g, " ")}</span>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-3)" }}>
            No leads match this bucket + search.
          </div>
        )}
      </div>
    </div>
  );
}
