"use client";

/**
 * Tabular alternative to the Kanban board.
 *
 * One row per lead with a presence-icon column for every platform
 * (Close, Airtable, Mighty Networks, Intercom, VendHub) so the team
 * can see at a glance which leads are missing from which platforms.
 *
 * Each present-platform icon is also a clickable deep-link to that
 * record on the platform's UI (same logic as the Cross-platform tab).
 */

import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import { PlatformLogos } from "./PlatformLogos";
import type { DesignLead, DesignStage } from "@/lib/design-adapter";
import {
  closeLink,
  airtableLink,
  mightyLink,
  intercomLink,
  vendhubLink,
} from "@/lib/platform-links";

type SortKey = "name" | "createdAtDesc" | "createdAtAsc" | "missing" | "owner" | "status";

const PLATFORMS: ("close" | "airtable" | "mighty" | "intercom" | "vendhub")[] = [
  "close",
  "airtable",
  "mighty",
  "intercom",
  "vendhub",
];

function presenceFor(lead: DesignLead, p: typeof PLATFORMS[number]): { present: boolean; link: { url: string; externalId?: string; label: string } | null } {
  const emailForSearch = lead.email && lead.email !== "—" ? lead.email : undefined;
  switch (p) {
    case "close": {
      const link = closeLink(lead._closeLeadId || lead._clientId, emailForSearch);
      const present = Boolean(lead._closeLeadId && lead._closeLeadId.startsWith("lead_"));
      return { present, link };
    }
    case "airtable":
      return { present: true, link: airtableLink(lead._airtableRecordId || lead.id) };
    case "mighty": {
      const link = mightyLink(lead._mnMemberId);
      return { present: Boolean(lead._mnMemberId), link };
    }
    case "intercom": {
      const link = intercomLink(lead._intercomContactId, emailForSearch);
      return { present: Boolean(lead._intercomContactId), link };
    }
    case "vendhub": {
      const link = vendhubLink(lead._vendHubUserId, lead._vendHubOrganization);
      return { present: Boolean(lead._vendHubUserId || lead._vendHubOrganization), link };
    }
  }
}

export function LeadsTableView({
  leads,
  stages,
  onSelect,
}: {
  leads: DesignLead[];
  stages: DesignStage[];
  onSelect: (l: DesignLead) => void;
}) {
  const [sort, setSort] = useState<SortKey>("missing");
  const [search, setSearch] = useState("");

  const enriched = useMemo(() => {
    return leads.map((l) => {
      const presence = PLATFORMS.map((p) => presenceFor(l, p));
      const missingCount = presence.filter((x) => !x.present).length;
      return { lead: l, presence, missingCount };
    });
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ lead }) => {
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.realSalesRep || "").toLowerCase().includes(q)
      );
    });
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.lead.company.localeCompare(b.lead.company));
        break;
      case "createdAtDesc":
        arr.sort((a, b) => (b.lead.createdAtRaw || "").localeCompare(a.lead.createdAtRaw || ""));
        break;
      case "createdAtAsc":
        arr.sort((a, b) => (a.lead.createdAtRaw || "").localeCompare(b.lead.createdAtRaw || ""));
        break;
      case "missing":
        // Most-missing first — these are the leads that need attention
        arr.sort((a, b) => b.missingCount - a.missingCount || a.lead.company.localeCompare(b.lead.company));
        break;
      case "owner":
        arr.sort((a, b) => (a.lead.realSalesRep || "zzz").localeCompare(b.lead.realSalesRep || "zzz"));
        break;
      case "status": {
        const rank: Record<string, number> = { error: 0, waiting: 1, processing: 2, done: 3 };
        arr.sort((a, b) => (rank[a.lead.status] ?? 9) - (rank[b.lead.status] ?? 9));
        break;
      }
    }
    return arr;
  }, [filtered, sort]);

  // Summary header — how many leads, how many missing 2+ platforms.
  const missingTwoPlus = enriched.filter((e) => e.missingCount >= 2).length;

  return (
    <div className="leads-table-view" style={{ width: "100%" }}>
      <div
        className="view-head"
        style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}
      >
        <div>
          <span className="eyebrow">Leads · table view</span>
          <h2>
            {sorted.length} leads {missingTwoPlus > 0 && (
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--err)", marginLeft: 8 }}>
                · {missingTwoPlus} missing 2+ platforms
              </span>
            )}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--ma-line)",
              borderRadius: 6,
              padding: "5px 10px",
              minWidth: 220,
            }}
          >
            <Icon.Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead, email, REP…"
              style={{
                background: "transparent",
                border: 0,
                outline: 0,
                color: "var(--fg-1)",
                fontSize: 12,
                width: "100%",
              }}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              background: "var(--ma-surface)",
              border: "1px solid var(--ma-line)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--fg-1)",
              cursor: "pointer",
            }}
          >
            <option value="missing">Most missing platforms first</option>
            <option value="name">Name A → Z</option>
            <option value="createdAtDesc">Newest first</option>
            <option value="createdAtAsc">Oldest first</option>
            <option value="owner">By REP</option>
            <option value="status">By status</option>
          </select>
        </div>
      </div>

      <div className="op-table" style={{ width: "100%" }}>
        <div
          className="op-row op-head"
          style={{
            gridTemplateColumns: "2fr 1.5fr 1fr 0.7fr repeat(5, 60px) 100px 80px",
            fontSize: 11,
          }}
        >
          <span>Lead</span>
          <span>Email</span>
          <span>REP</span>
          <span>Missing</span>
          {PLATFORMS.map((p) => {
            const Logo = PlatformLogos[p];
            return (
              <span key={p} style={{ textAlign: "center" }}>
                <Logo size={14} />
              </span>
            );
          })}
          <span>Status</span>
          <span></span>
        </div>
        {sorted.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-3)" }}>No leads match.</div>
        )}
        {sorted.map(({ lead, presence, missingCount }) => (
          <div
            key={lead.id}
            className="op-row"
            style={{
              gridTemplateColumns: "2fr 1.5fr 1fr 0.7fr repeat(5, 60px) 100px 80px",
              cursor: "pointer",
            }}
            onClick={() => onSelect(lead)}
          >
            <span>
              <div className="op-name">{lead.company}</div>
              <div className="op-sub" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                {lead.name}
              </div>
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              {lead.email || "—"}
            </span>
            <span style={{ fontSize: 12 }}>{lead.realSalesRep || "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: missingCount >= 2 ? "var(--err)" : missingCount === 1 ? "#a16207" : "var(--fg-3)" }}>
              {missingCount === 0 ? "✓ all" : `${missingCount} missing`}
            </span>
            {presence.map((p, i) => {
              const cell = (
                <span style={{ display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
                  {p.present ? (
                    <span style={{ color: "#10b25a", fontSize: 14 }}>●</span>
                  ) : (
                    <span style={{ color: "var(--err)", fontSize: 14 }}>○</span>
                  )}
                </span>
              );
              return p.link ? (
                <a
                  key={i}
                  href={p.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${p.link.label}${p.link.externalId ? " · " + p.link.externalId : ""}`}
                  style={{ textAlign: "center", textDecoration: "none" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {cell}
                </a>
              ) : (
                <span key={i} style={{ textAlign: "center" }}>{cell}</span>
              );
            })}
            <span>
              <span className={`lead-tag tag-${lead.status === "error" ? "error" : lead.status === "done" ? "success" : lead.status === "waiting" ? "waiting" : "processing"}`}>
                {lead.status}
              </span>
            </span>
            <span>
              <button
                className="btn btn--ghost btn--xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(lead);
                }}
              >
                Details
              </button>
            </span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div style={{ marginTop: 16, fontSize: 11, color: "var(--fg-3)", display: "flex", gap: 16 }}>
        <span><span style={{ color: "#10b25a" }}>●</span> on platform · click to open</span>
        <span><span style={{ color: "var(--err)" }}>○</span> not yet on platform</span>
      </div>
    </div>
  );
}
