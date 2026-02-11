"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Award,
  Clock,
  TrendingDown,
  AlertTriangle,
  Users,
  Activity,
} from "lucide-react";

import MetricCard from "@/components/cards/MetricCard";
import DonutChart from "@/components/charts/DonutChart";
import BarChart from "@/components/charts/BarChart";
import HeatMap from "@/components/charts/HeatMap";
import FunnelChart from "@/components/charts/FunnelChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  totalClients: number;
  clientsByStatus: Record<string, number>;
  clientsByStage: Record<string, number>;
  clientsByMembership: Record<string, number>;
  avgDaysInProgram: number;
  activeRefunds: number;
  refundReasons: Record<string, number>;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MEMBERSHIP_COLORS: Record<string, string> = {
  Platinum: "#8B5CF6",
  Gold: "#F59E0B",
  Silver: "#3B82F6",
  Bronze: "#F97316",
};

const STATUS_COLORS: Record<string, string> = {
  "Doing Fine": "#10B981",
  Sinking: "#EF4444",
  Onboarding: "#3B82F6",
  "Warm Leads Sent": "#F59E0B",
  Scaling: "#8B5CF6",
  Paused: "#6B7280",
  Churned: "#991B1B",
  "Full Refund": "#DC2626",
};

const STAGE_ORDER = [
  "1. Onboarding",
  "2. Rookie",
  "3. Email Campaign",
  "4. Marketing",
  "5. Boots on Ground",
  "6. Contract Signed",
  "7. Machine Purchased",
  "8. Scaling",
];

const STAGE_COLORS = [
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#10B981",
];

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
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
// Main Component
// ---------------------------------------------------------------------------
export default function ClientsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [heatmapData, setHeatmapData] = useState<
    { row: string; col: string; value: number }[] | null
  >(null);
  const [loading, setLoading] = useState(true);

  // ---- Fetch stats and heatmap data in parallel ----
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, clientsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch(
            "/api/airtable?table=clients&fields=Status,Program Stages"
          ),
        ]);

        const statsData = await statsRes.json();
        // API returns nested { overview, clients, revenue, ... }
        const cl = statsData.clients ?? {};
        const ov = statsData.overview ?? {};
        const rv = statsData.revenue ?? {};
        setStats({
          totalClients: cl.total ?? ov.totalClients ?? 0,
          clientsByStatus: cl.statusBreakdown ?? ov.clientStatusBreakdown ?? {},
          clientsByStage: cl.programStageBreakdown ?? ov.programStageBreakdown ?? {},
          clientsByMembership: cl.membershipBreakdown ?? ov.membershipLevelBreakdown ?? {},
          avgDaysInProgram: cl.avgDaysInProgram ?? 0,
          activeRefunds: rv.totalRefunds ?? ov.totalRefunds ?? 0,
          refundReasons: rv.refundReasons ?? {},
        });

        // Build heatmap cross-tabulation from raw client records
        const clientsData = await clientsRes.json();
        if (clientsData.records) {
          const crossTab: Record<string, Record<string, number>> = {};
          const allStatuses = new Set<string>();
          const allStages = new Set<string>();

          clientsData.records.forEach((rec: AirtableRecord) => {
            const status = String(rec.fields["Status"] ?? "Unknown");
            const stage = String(rec.fields["Program Stages"] ?? "Unknown");
            allStatuses.add(status);
            allStages.add(stage);

            if (!crossTab[status]) crossTab[status] = {};
            crossTab[status][stage] = (crossTab[status][stage] || 0) + 1;
          });

          const heatData: { row: string; col: string; value: number }[] = [];
          allStatuses.forEach((status) => {
            allStages.forEach((stage) => {
              heatData.push({
                row: status,
                col: stage,
                value: crossTab[status]?.[stage] || 0,
              });
            });
          });

          setHeatmapData(heatData);
        }
      } catch (err) {
        console.error("Failed to fetch client data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // ---- Computed values ----
  const membershipData = useMemo(() => {
    if (!stats?.clientsByMembership) return [];
    return Object.entries(stats.clientsByMembership).map(([name, value]) => ({
      name,
      value,
      color: MEMBERSHIP_COLORS[name] || "#6B7280",
    }));
  }, [stats]);

  const statusData = useMemo(() => {
    if (!stats?.clientsByStatus) return [];
    return Object.entries(stats.clientsByStatus).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || "#6B7280",
    }));
  }, [stats]);

  const funnelStages = useMemo(() => {
    if (!stats?.clientsByStage) return [];
    return STAGE_ORDER.map((stage, i) => ({
      name: stage,
      value: stats.clientsByStage[stage] || 0,
      color: STAGE_COLORS[i] || "#6B7280",
    }));
  }, [stats]);

  const refundReasonsData = useMemo(() => {
    if (!stats?.refundReasons) return [];
    return Object.entries(stats.refundReasons)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const churnRate = useMemo(() => {
    if (!stats?.clientsByStatus) return 0;
    const total = Object.values(stats.clientsByStatus).reduce((a, b) => a + b, 0);
    const churned =
      (stats.clientsByStatus["Churned"] || 0) +
      (stats.clientsByStatus["Full Refund"] || 0);
    return total > 0 ? Math.round((churned / total) * 1000) / 10 : 0;
  }, [stats]);

  const platinumCount = stats?.clientsByMembership?.["Platinum"] ?? 0;
  const silverCount = stats?.clientsByMembership?.["Silver"] ?? 0;

  const totalRefunds = useMemo(() => {
    if (!stats?.refundReasons) return 0;
    return Object.values(stats.refundReasons).reduce((a, b) => a + b, 0);
  }, [stats]);

  // Heatmap labels
  const heatmapRows = useMemo(() => {
    if (!heatmapData) return [];
    return [...new Set(heatmapData.map((d) => d.row))];
  }, [heatmapData]);

  const heatmapCols = useMemo(() => {
    if (!heatmapData) return [];
    const cols = [...new Set(heatmapData.map((d) => d.col))];
    // Sort stages in natural order
    return cols.sort((a, b) => {
      const aIdx = STAGE_ORDER.indexOf(a);
      const bIdx = STAGE_ORDER.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [heatmapData]);

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Client Lifecycle
            </h1>
            <p className="text-sm text-text-muted">
              Membership, retention, program stages & refund analysis
            </p>
          </div>
        </div>
      </motion.div>

      {/* ============ ROW 1: KPI Cards ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Platinum Members"
              value={platinumCount}
              icon={Crown}
              subtitle="Top-tier clients"
              trend={platinumCount > 0 ? "up" : undefined}
              trendValue={platinumCount > 0 ? "Premium" : undefined}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Silver Members"
              value={silverCount}
              icon={Award}
              subtitle="Standard members"
              trend={silverCount > 0 ? "up" : undefined}
              trendValue={silverCount > 0 ? "Active" : undefined}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Avg Days in Program"
              value={stats?.avgDaysInProgram ?? 0}
              icon={Clock}
              subtitle="Client tenure"
              suffix=" days"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Churn Rate"
              value={churnRate}
              icon={TrendingDown}
              subtitle="Churned + Full Refund"
              suffix="%"
              trend={churnRate > 10 ? "down" : "up"}
              trendValue={churnRate > 10 ? "High" : "Healthy"}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <MetricCard
              title="Active Refunds"
              value={stats?.activeRefunds ?? 0}
              icon={AlertTriangle}
              subtitle="Pending disbursement"
              trend={
                (stats?.activeRefunds ?? 0) > 0 ? "down" : "up"
              }
              trendValue={
                (stats?.activeRefunds ?? 0) > 0 ? "Attention" : "Clear"
              }
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 2: Membership Donut + Status Bar ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <motion.div variants={itemVariants}>
            <DonutChart
              data={membershipData}
              title="Membership Level Distribution"
              centerLabel="Members"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <BarChart
              data={statusData}
              title="Client Status Overview"
              layout="vertical"
              color="#3B82F6"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 3: Heatmap + Funnel ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <motion.div variants={itemVariants}>
            {heatmapData && heatmapRows.length > 0 && heatmapCols.length > 0 ? (
              <HeatMap
                data={heatmapData}
                rowLabels={heatmapRows}
                colLabels={heatmapCols}
                title="Client Health Heatmap (Status vs Stage)"
              />
            ) : (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-4">
                  Client Health Heatmap
                </h3>
                <div className="flex items-center justify-center h-64 text-text-muted text-sm">
                  No cross-tabulation data available
                </div>
              </div>
            )}
          </motion.div>

          <motion.div variants={itemVariants}>
            <FunnelChart
              data={funnelStages}
              title="Program Stage Funnel"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ============ ROW 4: Refund Analysis ============ */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonChart />
          </div>
          <SkeletonCard />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <BarChart
              data={refundReasonsData}
              title="Refund Reasons Breakdown"
              layout="vertical"
              color="#EF4444"
            />
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col gap-6">
            <MetricCard
              title="Total Refund Cases"
              value={totalRefunds}
              icon={AlertTriangle}
              subtitle="All time complaints"
              trend={totalRefunds > 0 ? "down" : "up"}
              trendValue={totalRefunds > 0 ? `${stats?.activeRefunds ?? 0} pending` : "None"}
            />
            <div className="glass-card p-6 flex-1">
              <h3 className="text-sm font-semibold text-text-secondary mb-4">
                Refund Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Active (Pending)</span>
                  <span className="text-lg font-bold text-danger">
                    {stats?.activeRefunds ?? 0}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        totalRefunds > 0
                          ? `${((stats?.activeRefunds ?? 0) / totalRefunds) * 100}%`
                          : "0%",
                    }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Disbursed</span>
                  <span className="text-lg font-bold text-success">
                    {totalRefunds - (stats?.activeRefunds ?? 0)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width:
                        totalRefunds > 0
                          ? `${((totalRefunds - (stats?.activeRefunds ?? 0)) / totalRefunds) * 100}%`
                          : "0%",
                    }}
                    transition={{ duration: 1, delay: 0.7 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Footer spacer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex items-center gap-2 text-xs text-text-muted pt-4"
      >
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <span>Live data &middot; Auto-refreshes every 5 minutes</span>
      </motion.div>
    </div>
  );
}
