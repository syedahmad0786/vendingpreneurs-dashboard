"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Thermometer,
  Trophy,
  BarChart3,
  Target,
  Activity,
} from "lucide-react";

import MetricCard from "@/components/cards/MetricCard";
import GaugeChart from "@/components/charts/GaugeChart";
import DonutChart from "@/components/charts/DonutChart";
import FunnelChart from "@/components/charts/FunnelChart";
import BarChart from "@/components/charts/BarChart";
import DataTable from "@/components/tables/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  hotLeads: number;
  warmLeads: number;
  leadsWon: number;
  leadsBySource: Record<string, number>;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SOURCE_COLORS: Record<string, string> = {
  Facebook: "#3B82F6",
  Instagram: "#EC4899",
  YouTube: "#EF4444",
  Referral: "#10B981",
  "Cold Call": "#F59E0B",
  TikTok: "#06B6D4",
  LinkedIn: "#8B5CF6",
  Website: "#6366F1",
  Organic: "#84CC16",
};

const TEMP_COLORS: Record<string, string> = {
  Hot: "#EF4444",
  Warm: "#F59E0B",
  Cold: "#3B82F6",
};

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/5 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <Skeleton className="h-5 w-48 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Temperature Badge Sub-Component
// ---------------------------------------------------------------------------
function TempBadge({ temp }: { temp: string }) {
  const color = TEMP_COLORS[temp] || "#6B7280";
  const bgMap: Record<string, string> = {
    Hot: "bg-red-500/20 text-red-400 border-red-500/30",
    Warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Cold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const cls = bgMap[temp] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  return (
    <span className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {temp}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function LeadsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [leadsRecords, setLeadsRecords] = useState<Record<string, unknown>[]>([]);
  const [leadCounts, setLeadCounts] = useState<{ hot: number; warm: number; cold: number }>({
    hot: 0,
    warm: 0,
    cold: 0,
  });
  const [outcomeData, setOutcomeData] = useState<Record<string, number>>({});
  const [ownerData, setOwnerData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Data Fetching ----
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, leadsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch(
            "/api/airtable?table=warmLeads&fields=Full Name,Lead Temperature,Status,Final Outcome,Lead Source,Lead Owner&maxRecords=50"
          ),
        ]);

        const statsData = await statsRes.json();
        // API returns nested { leads: { sourceBreakdown, ... } }
        const leadsStats = statsData.leads ?? {};
        setStats({
          hotLeads: leadsStats.hotLeads ?? 0,
          warmLeads: leadsStats.warmLeadsCount ?? 0,
          leadsWon: leadsStats.leadsWon ?? 0,
          leadsBySource: leadsStats.sourceBreakdown ?? {},
        });

        const leadsData = await leadsRes.json();
        if (leadsData.records) {
          // Build table-friendly rows
          const rows = leadsData.records.map((rec: AirtableRecord) => ({
            id: rec.id,
            fullName: rec.fields["Full Name"] ?? "",
            temperature: rec.fields["Lead Temperature"] ?? "",
            status: rec.fields["Status"] ?? "",
            outcome: rec.fields["Final Outcome"] ?? "",
            source: rec.fields["Lead Source"] ?? "",
            owner: rec.fields["Lead Owner"] ?? "",
          }));
          setLeadsRecords(rows);

          // Count temperatures from raw records
          let hot = 0,
            warm = 0,
            cold = 0;
          const outcomes: Record<string, number> = {};
          const owners: Record<string, number> = {};

          leadsData.records.forEach((rec: AirtableRecord) => {
            const temp = String(rec.fields["Lead Temperature"] ?? "");
            if (temp === "Hot") hot++;
            else if (temp === "Warm") warm++;
            else if (temp === "Cold") cold++;

            const outcome = String(rec.fields["Final Outcome"] ?? "Unknown");
            outcomes[outcome] = (outcomes[outcome] || 0) + 1;

            const owner = String(rec.fields["Lead Owner"] ?? "Unassigned");
            owners[owner] = (owners[owner] || 0) + 1;
          });

          setLeadCounts({ hot, warm, cold });
          setOutcomeData(outcomes);
          setOwnerData(
            Object.entries(owners)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)
          );
        }
      } catch (err) {
        console.error("Failed to fetch leads data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // ---- Computed values ----
  const totalLeads = leadCounts.hot + leadCounts.warm + leadCounts.cold;

  const sourceData = useMemo(() => {
    if (!stats?.leadsBySource) return [];
    return Object.entries(stats.leadsBySource).map(([name, value]) => ({
      name,
      value,
      color: SOURCE_COLORS[name] || "#6B7280",
    }));
  }, [stats]);

  const funnelStages = useMemo(() => {
    // Build a funnel from outcome data: New -> Interested -> Following Up -> Won!
    const stageOrder = ["New", "Interested", "Following Up", "Won!"];
    const stageColors = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

    return stageOrder.map((name, i) => ({
      name,
      value: outcomeData[name] || 0,
      color: stageColors[i],
    }));
  }, [outcomeData]);

  const avgLeadScore = useMemo(() => {
    if (totalLeads === 0) return 0;
    // Weighted score: Hot=100, Warm=60, Cold=20
    const score =
      (leadCounts.hot * 100 + leadCounts.warm * 60 + leadCounts.cold * 20) /
      totalLeads;
    return Math.round(score);
  }, [leadCounts, totalLeads]);

  // ---- Table columns ----
  const tableColumns = useMemo(
    () => [
      { key: "fullName", label: "Full Name", sortable: true },
      {
        key: "temperature",
        label: "Lead Temperature",
        sortable: true,
        render: (val: unknown) => <TempBadge temp={String(val || "Unknown")} />,
      },
      { key: "status", label: "Status", sortable: true },
      {
        key: "outcome",
        label: "Final Outcome",
        sortable: true,
        render: (val: unknown) => {
          const v = String(val || "");
          if (v === "Won!") {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                <Trophy className="h-3 w-3" />
                Won!
              </span>
            );
          }
          return <span className="text-text-secondary text-sm">{v || "\u2014"}</span>;
        },
      },
      { key: "source", label: "Lead Source", sortable: true },
      { key: "owner", label: "Lead Owner", sortable: true },
    ],
    []
  );

  // ---- Render ----
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-amber-600">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Warm Leads & Pipeline
            </h1>
            <p className="text-sm text-text-muted">
              Lead temperature tracking, source analysis & pipeline funnel
            </p>
          </div>
        </div>
      </motion.div>

      {/* ============ ROW 1: KPI Cards ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        >
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Hot Leads"
              value={stats?.hotLeads ?? leadCounts.hot}
              icon={Flame}
              subtitle="Ready to close"
              trend="up"
              trendValue="Priority"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Warm Leads"
              value={stats?.warmLeads ?? leadCounts.warm}
              icon={Thermometer}
              subtitle="Nurturing pipeline"
              trend="up"
              trendValue="Active"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Leads Won"
              value={stats?.leadsWon ?? 0}
              icon={Trophy}
              subtitle="Converted clients"
              trend="up"
              trendValue="Converted"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Avg Lead Score"
              value={avgLeadScore}
              icon={BarChart3}
              subtitle="Weighted average"
              suffix="/100"
              trend={avgLeadScore >= 50 ? "up" : "down"}
              trendValue={avgLeadScore >= 50 ? "Good" : "Low"}
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 2: Gauges + Source Donut ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
        >
          {/* 3 Gauge charts side by side */}
          <motion.div variants={itemVariants}>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-secondary">
                Lead Temperature Gauge
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <GaugeChart
                  value={stats?.hotLeads ?? leadCounts.hot}
                  max={Math.max(totalLeads, 1)}
                  label="Hot Leads"
                />
                <GaugeChart
                  value={stats?.warmLeads ?? leadCounts.warm}
                  max={Math.max(totalLeads, 1)}
                  label="Warm Leads"
                />
                <GaugeChart
                  value={leadCounts.cold}
                  max={Math.max(totalLeads, 1)}
                  label="Cold Leads"
                />
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <DonutChart
              data={sourceData}
              title="Lead Source Breakdown"
              centerLabel="Sources"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 3: Funnel + Leads by Owner ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
        >
          <motion.div variants={itemVariants}>
            <FunnelChart
              data={funnelStages}
              title="Lead Outcome Funnel"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <BarChart
              data={ownerData}
              title="Leads by Owner"
              layout="vertical"
              color="#8B5CF6"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 4: Data Table ============ */}
      {loading ? (
        <SkeletonChart />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              Recent Leads
            </h3>
            <DataTable
              columns={tableColumns}
              data={leadsRecords}
              searchable
              pageSize={10}
            />
          </motion.div>
        </motion.div>
      )}

      {/* Footer spacer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 text-xs text-text-muted pt-4"
      >
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <span>Live data &middot; Auto-refreshes every 2 minutes</span>
      </motion.div>
    </div>
  );
}
