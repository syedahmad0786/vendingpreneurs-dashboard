"use client";

import "./design.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { LeadPipeline, StepId } from "@/lib/pipeline";
import { adaptLeads, DESIGN_STAGES, type DesignLead } from "@/lib/design-adapter";
import {
  TopBar,
  SubBar,
  KPIStrip,
  IntegrationsRail,
  BoardToolbar,
  ToastStack,
  type Toast,
  type SortKey,
} from "@/components/design/DashboardShell";
import { PipelineBoard } from "@/components/design/Board";
import { LeadDrawer } from "@/components/design/LeadDrawer";
import { OperatorsView, ErrorsView, IntegrationsView, AnalyticsView } from "@/components/design/Views";
import { CrossPlatformView } from "@/components/design/CrossPlatformView";

interface PipelineResponse {
  leads: LeadPipeline[];
  summary: {
    total: number;
    completed: number;
    errored: number;
    inProgress: number;
    waitingForCustomer?: {
      total: number;
      mightyNetworks: number;
      intercom: number;
      vendhub: number;
    };
    byStep: Record<StepId, { success: number; error: number; pending: number; waiting?: number }>;
  };
  generatedAt: string;
}

const POLL_INTERVAL_MS = 20_000;

export default function OnboardingPipelinePage() {
  const [activeNav, setActiveNav] = useState<"pipeline" | "operators" | "errors" | "integrations" | "analytics" | "cross-platform">("pipeline");
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("createdDesc");
  const [selected, setSelected] = useState<DesignLead | null>(null);
  const [retryingKeys, setRetryingKeys] = useState<Set<string>>(new Set());
  const [resolvingKeys, setResolvingKeys] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resolvingAll, setResolvingAll] = useState(false);

  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toastIdRef = useRef(1);
  const adaptedRef = useRef<DesignLead[] | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") document.body.classList.toggle("dark", dark);
    return () => { if (typeof document !== "undefined") document.body.classList.remove("dark"); };
  }, [dark]);

  const load = useCallback(async (fresh = false) => {
    try {
      if (!data) setLoading(true);
      if (fresh) setRefreshing(true);
      const res = await fetch(`/api/onboarding/pipeline${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PipelineResponse;
      setData(json);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Could not load pipeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const pushToast = (type: Toast["type"], text: string) => {
    const id = toastIdRef.current++;
    setToasts((ts) => [...ts, { id, type, text }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 5500);
  };

  // Fire-and-forget: nudges Supabase to re-sync ONE lead's current Airtable
  // state. Called right after retry/resolve actions so the Cross-platform
  // tab + SQL views reflect the change within 1–2 seconds.
  const triggerSupabaseSync = (airtableId: string) => {
    try {
      fetch("/api/supabase/sync-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airtableId }),
        keepalive: true,
      }).catch(() => { /* background — never block UI on this */ });
    } catch { /* no-op */ }
  };

  const adapted = useMemo<DesignLead[]>(() => adaptLeads(data?.leads ?? []), [data]);
  useEffect(() => { adaptedRef.current = adapted; }, [adapted]);

  const owners = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [{ value: "all", label: "All owners" }];
    for (const l of adapted) {
      if (!l.realSalesRep || seen.has(l.owner)) continue;
      seen.add(l.owner);
      out.push({ value: l.owner, label: l.realSalesRep });
    }
    return out.slice(0, 5);
  }, [adapted]);

  const filtered = useMemo(() => {
    const statusRank: Record<string, number> = {
      error: 0, waiting: 1, processing: 2, done: 3,
    };
    return adapted
      .filter((l) => {
        if (filter === "errors" && l.status !== "error") return false;
        if (filter === "processing" && l.status !== "processing") return false;
        if (filter === "done" && l.status !== "done") return false;
        if (filter === "waiting" && l.status !== "waiting") return false;
        if (filter === "waiting-mn" && !l.waitingOnMN) return false;
        if (filter === "waiting-vendhub" && !l.waitingOnVendhub) return false;
        if (filter === "waiting-intercom" && !l.waitingOnIntercom) return false;
        if (owner !== "all" && l.owner !== owner) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!(
            l.name.toLowerCase().includes(q) ||
            l.company.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q) ||
            l.id.toLowerCase().includes(q)
          )) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Dashboard data already arrives newest-first from Airtable, so we
        // can use the backing LeadPipeline.createdAt by looking up raw data.
        const aRaw = data?.leads.find((l) => l.id === a.id)?.createdAt || "";
        const bRaw = data?.leads.find((l) => l.id === b.id)?.createdAt || "";
        switch (sort) {
          case "createdAsc":
            return aRaw.localeCompare(bRaw);
          case "createdDesc":
            return bRaw.localeCompare(aRaw);
          case "stageDesc":
            return b.currentStage - a.currentStage;
          case "stageAsc":
            return a.currentStage - b.currentStage;
          case "status":
            return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
          case "owner":
            return (a.realSalesRep || "zzz").localeCompare(b.realSalesRep || "zzz");
          default:
            return 0;
        }
      });
  }, [adapted, filter, owner, search, sort, data]);

  const leadsByStage = useMemo(() => {
    const m: Record<string, DesignLead[]> = {};
    DESIGN_STAGES.forEach((s) => (m[s.id] = []));
    for (const l of filtered) {
      if (l.status === "waiting") {
        // Waiting leads show up in EVERY column they're waiting on — so a
        // lead waiting on both MN and VendHub appears in both columns.
        // The same lead isn't double-counted in top-level KPIs (those
        // count unique leads).
        let placed = false;
        if (l.waitingOnMN) {
          m["mighty"].push(l);
          placed = true;
        }
        if (l.waitingOnVendhub) {
          m["vendhub"].push(l);
          placed = true;
        }
        if (l.waitingOnIntercom) {
          m["intercom"].push(l);
          placed = true;
        }
        // Fallback: if flags somehow unset, place in currentStage column.
        if (!placed) {
          const s = DESIGN_STAGES[l.currentStage];
          if (s) m[s.id].push(l);
        }
      } else {
        const s = DESIGN_STAGES[l.currentStage];
        if (s) m[s.id].push(l);
      }
    }
    return m;
  }, [filtered]);

  const counts = useMemo(() => {
    const total = adapted.length;
    const inFlight = adapted.filter((l) => l.status === "processing").length;
    const stuck = adapted.filter((l) => l.status === "error").length;
    const live = adapted.filter((l) => l.status === "done").length;
    const waiting = adapted.filter((l) => l.status === "waiting").length;
    return { total, inFlight, stuck, live, waiting };
  }, [adapted]);

  // Per-stage lead lists for the Integration Health drill-through.
  // Keyed by stepId (close_crm, email_validation, etc).
  const stageLeadLists = useMemo(() => {
    const m: Record<string, { success: DesignLead[]; error: DesignLead[]; waiting: DesignLead[]; pending: DesignLead[] }> = {};
    DESIGN_STAGES.forEach((s) => (m[s.stepId] = { success: [], error: [], waiting: [], pending: [] }));
    for (const l of adapted) {
      const tlByStep: Record<string, string> = {};
      l.timeline.forEach((t) => { tlByStep[t.stepId] = t.status; });
      for (const stage of DESIGN_STAGES) {
        const tStatus = tlByStep[stage.stepId];
        const step = data?.leads.find((d) => d.id === l.id)?.steps.find((s) => s.id === stage.stepId);
        if (!step) continue;
        if (step.status === "success") m[stage.stepId].success.push(l);
        else if (step.status === "error") m[stage.stepId].error.push(l);
        else if (step.status === "waiting_for_customer") m[stage.stepId].waiting.push(l);
        else m[stage.stepId].pending.push(l);
        void tStatus;
      }
    }
    return m;
  }, [adapted, data]);

  const handleDrill = useCallback((stepId: string, bucket: "success" | "error" | "waiting" | "pending") => {
    // Map stage + bucket to a board filter.
    setActiveNav("pipeline");
    if (bucket === "error") setFilter("errors");
    else if (bucket === "success") setFilter("done");
    else if (bucket === "waiting") {
      if (stepId === "mighty_networks") setFilter("waiting-mn");
      else if (stepId === "vendhub") setFilter("waiting-vendhub");
      else if (stepId === "intercom") setFilter("waiting-intercom");
      else setFilter("waiting");
    } else if (bucket === "pending") {
      setFilter("processing");
    }
    // Scroll the board into view
    setTimeout(() => {
      const el = document.querySelector(".board");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fresh = adapted.find((l) => l.id === selected.id);
    if (fresh) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapted]);

  const handleRetry = useCallback(
    async (lead: DesignLead, stageIdx: number) => {
      const stage = DESIGN_STAGES[stageIdx];
      const key = `${lead.id}-${stageIdx}`;
      setRetryingKeys((prev) => new Set(prev).add(key));
      try {
        const res = await fetch("/api/onboarding/resubmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadRecordId: lead.id,
            step: stage.stepId,
            context: {
              fullName: lead.name,
              email: lead.email,
              clientId: lead._clientId,
              programTier: lead._programTier,
            },
          }),
        });
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.ok && (body as { success?: boolean }).success !== false) {
          pushToast("success", `${lead.company} · ${stage.title} retry triggered`);
          setTimeout(() => load(true), 1500);
          // Nudge Supabase to reflect the new state for this lead immediately.
          triggerSupabaseSync(lead.id);
        } else {
          // Surface the real reason: status + message + raw body excerpt
          const msg = (body as { message?: string }).message || `HTTP ${res.status}`;
          const raw = (body as { raw?: string }).raw
            ? ` · ${(body as { raw: string }).raw.slice(0, 120).replace(/\s+/g, " ").trim()}`
            : "";
          pushToast("error", `${lead.company} · ${stage.title} retry failed — ${msg}${raw}`);
        }
      } catch (err) {
        pushToast("error", err instanceof Error ? err.message : "Network error");
      } finally {
        setRetryingKeys((prev) => {
          const n = new Set(prev); n.delete(key); return n;
        });
      }
    },
    [load]
  );

  const handleResolveAll = useCallback(async () => {
    setResolvingAll(true);
    try {
      const res = await fetch("/api/onboarding/resolve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        pushToast("success", `Marked ${body.resolved} error${body.resolved === 1 ? "" : "s"} as Resolved`);
        setTimeout(() => load(true), 1200);
        // Bulk action — trigger a full resync so Supabase picks up all changes.
        fetch("/api/supabase/sync", { method: "POST", keepalive: true }).catch(() => {});
      } else {
        pushToast("error", body.message || `Could not resolve (HTTP ${res.status})`);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Network error");
    } finally {
      setResolvingAll(false);
    }
  }, [load]);

  // Resolve every open error row tied to a lead+step combo. Sweeps dupes so
  // the pipeline doesn't re-derive the same error from a leftover row.
  const handleResolveForLeadStep = useCallback(
    async (lead: DesignLead, stepId: string, label?: string) => {
      const key = `${lead.id}-${stepId}`;
      setResolvingKeys((prev) => new Set(prev).add(key));

      // Optimistically drop the resolved error from local view so the UI feels instant.
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leads: prev.leads.map((l) => {
            if (l.id !== lead.id) return l;
            return {
              ...l,
              steps: l.steps.map((s) => {
                if (s.id !== stepId) return s;
                if (s.status !== "error") return s;
                return { ...s, status: "pending", errorMessage: undefined, error: undefined, errorRecordId: undefined };
              }),
            };
          }),
        };
      });

      try {
        const res = await fetch("/api/onboarding/errors/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadRecordId: lead.id,
            email: lead.email,
            leadId: lead._clientId,
            step: stepId,
            errorRecordId: lead.statusError?.errorRecordId,
          }),
        });
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.ok && (body as { success?: boolean }).success) {
          const n = (body as { resolved?: number }).resolved ?? 0;
          pushToast(
            "success",
            n > 1
              ? `${label || lead.company} — ${n} duplicate error rows resolved`
              : `${label || lead.company} — marked Resolved`
          );
          // Wait 2.5s for Airtable replica consistency, then re-fetch authoritative state.
          setTimeout(() => load(true), 2500);
          // Nudge Supabase to reflect the resolved state for this lead.
          triggerSupabaseSync(lead.id);
        } else {
          const msg = (body as { message?: string }).message || `HTTP ${res.status}`;
          pushToast("error", `Could not resolve — ${msg}`);
          // Roll back optimistic change by re-loading.
          setTimeout(() => load(true), 500);
        }
      } catch (err) {
        pushToast("error", err instanceof Error ? err.message : "Network error");
        setTimeout(() => load(true), 500);
      } finally {
        setResolvingKeys((prev) => {
          const n = new Set(prev); n.delete(key); return n;
        });
      }
    },
    [load]
  );

  // Back-compat shim for drawer: old signature (errorRecordId) is translated
  // into the new sweep by matching the lead+step currently rendered.
  const handleResolveError = useCallback(
    async (errorRecordId: string, _leadId?: string) => {
      if (!data) return;
      for (const l of data.leads) {
        const step = l.steps.find((s) => s.errorRecordId === errorRecordId);
        if (step) {
          // adapt: find the DesignLead representation
          const adaptedLead = adaptedRef.current?.find((a) => a.id === l.id);
          if (adaptedLead) {
            handleResolveForLeadStep(adaptedLead, step.id, adaptedLead.company);
            return;
          }
        }
      }
      // Fallback: single-row resolve
      setResolvingKeys((prev) => new Set(prev).add(errorRecordId));
      try {
        const res = await fetch("/api/onboarding/errors/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorRecordId }),
        });
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.ok && (body as { success?: boolean }).success) {
          pushToast("success", "Error marked Resolved");
          setTimeout(() => load(true), 2500);
        } else {
          const msg = (body as { message?: string }).message || `HTTP ${res.status}`;
          pushToast("error", `Could not resolve — ${msg}`);
        }
      } catch (err) {
        pushToast("error", err instanceof Error ? err.message : "Network error");
      } finally {
        setResolvingKeys((prev) => {
          const n = new Set(prev); n.delete(errorRecordId); return n;
        });
      }
    },
    [data, load, handleResolveForLeadStep]
  );

  const handleResolveOneFromList = useCallback(
    (l: DesignLead) => {
      const stepId = DESIGN_STAGES[l.currentStage]?.stepId;
      if (!stepId) {
        pushToast("error", `${l.company} — cannot identify step`);
        return;
      }
      handleResolveForLeadStep(l, stepId, l.company);
    },
    [handleResolveForLeadStep]
  );

  return (
    <div className="app">
      <TopBar
        activeNav={activeNav}
        setActiveNav={(v) => setActiveNav(v as typeof activeNav)}
        dark={dark}
        setDark={setDark}
        search={search}
        setSearch={setSearch}
      />

      <SubBar
        owner={owner}
        setOwner={setOwner}
        owners={owners}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {activeNav === "pipeline" && (
        <main className="main">
          <KPIStrip
            total={counts.total}
            inFlight={counts.inFlight}
            stuck={counts.stuck}
            live={counts.live}
            waiting={data?.summary.waitingForCustomer}
          />
          <IntegrationsRail
            stages={DESIGN_STAGES}
            byStep={data?.summary.byStep}
            leadLists={stageLeadLists}
            onDrill={handleDrill}
            updatedAt={data?.generatedAt}
          />
          <BoardToolbar filter={filter} setFilter={setFilter} counts={counts} sort={sort} setSort={setSort} />
          {loading && !data ? (
            <div className="board">
              {DESIGN_STAGES.map((s) => (
                <div key={s.id} className="col">
                  <div className="col-head">
                    <div className="col-head-l">
                      <div className="col-title">
                        <span className="stage-num">Stage {s.num}</span>
                        {s.title}
                      </div>
                    </div>
                  </div>
                  <div className="col-body">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="lead-card" style={{ opacity: 0.4 }}>
                        <div className="lead-name" style={{ height: 14, background: "var(--ma-line)", borderRadius: 3, width: "60%" }} />
                        <div className="lead-email" style={{ height: 10, background: "var(--ma-line)", borderRadius: 3, width: "80%" }} />
                        <div className="lead-progress">
                          {[0, 1, 2, 3, 4, 5].map((j) => <span key={j} className="step" />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PipelineBoard
              stages={DESIGN_STAGES}
              leadsByStage={leadsByStage}
              onCardClick={setSelected}
              onRetry={handleRetry}
              retryingKeys={retryingKeys}
            />
          )}
        </main>
      )}

      {activeNav === "operators" && (
        <main className="main">
          <OperatorsView leads={adapted} stages={DESIGN_STAGES} onSelect={setSelected} />
        </main>
      )}

      {activeNav === "errors" && (
        <main className="main">
          <ErrorsView
            leads={adapted}
            stages={DESIGN_STAGES}
            onRetry={handleRetry}
            retryingKeys={retryingKeys}
            onSelect={setSelected}
            onResolveAll={handleResolveAll}
            resolvingAll={resolvingAll}
            onResolveOne={handleResolveOneFromList}
            resolvingKeys={resolvingKeys}
          />
        </main>
      )}

      {activeNav === "cross-platform" && (
        <main className="main">
          <CrossPlatformView />
        </main>
      )}

      {activeNav === "integrations" && (
        <main className="main">
          <IntegrationsView leads={adapted} stages={DESIGN_STAGES} byStep={data?.summary.byStep} />
        </main>
      )}

      {activeNav === "analytics" && (
        <main className="main">
          <AnalyticsView leads={adapted} stages={DESIGN_STAGES} byStep={data?.summary.byStep} />
        </main>
      )}

      <LeadDrawer
        lead={selected}
        stages={DESIGN_STAGES}
        onClose={() => setSelected(null)}
        onRetry={handleRetry}
        retryingKeys={retryingKeys}
        onResolveError={(rid) => handleResolveError(rid, selected?.company)}
        resolvingKeys={resolvingKeys}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
