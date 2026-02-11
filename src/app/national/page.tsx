"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle,
  GitBranch,
  Map,
  Activity,
} from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import FunnelChart from "@/components/charts/FunnelChart";
import BarChart from "@/components/charts/BarChart";
import DataTable from "@/components/tables/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  nationalProperties: number;
  nationalByStage: Record<string, number>;
  nationalByPropertyGroup: Record<string, number>;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stage pipeline colors
// ---------------------------------------------------------------------------
const STAGE_COLORS: Record<string, string> = {
  Identifying: "#3B82F6",
  "Site Survey": "#6366F1",
  Approval: "#8B5CF6",
  "Equipment Ordered": "#F59E0B",
  Installation: "#EC4899",
  Complete: "#10B981",
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  Identifying: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Site Survey": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  Approval: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Equipment Ordered": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Installation: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Complete: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-white/5 ${className}`}
    >
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
// Animation variants
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
// Page Component
// ---------------------------------------------------------------------------
export default function NationalContractsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  // Fetch stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch table data
  useEffect(() => {
    fetch(
      "/api/airtable?table=nationalContractsMSA&fields=Property Name,Stages,Property Group,Machine Company,Rev Share Type&maxRecords=100"
    )
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.records || []).map((r: AirtableRecord) => ({
          id: r.id,
          "Property Name": r.fields["Property Name"] ?? "",
          Stages: r.fields["Stages"] ?? "",
          "Property Group": r.fields["Property Group"] ?? "",
          "Machine Company": r.fields["Machine Company"] ?? "",
          "Rev Share Type": r.fields["Rev Share Type"] ?? "",
        }));
        setTableData(rows);
        setTableLoading(false);
      })
      .catch(() => setTableLoading(false));
  }, []);

  // Derived KPIs
  const nationalProperties = stats?.nationalProperties ?? 0;
  const byStage = stats?.nationalByStage ?? {};
  const byGroup = stats?.nationalByPropertyGroup ?? {};

  const completeCount = byStage["Complete"] ?? 0;
  const pipelineCount = useMemo(() => {
    return Object.entries(byStage).reduce((sum, [key, val]) => {
      if (key !== "Complete") return sum + val;
      return sum;
    }, 0);
  }, [byStage]);

  const uniqueGroups = Object.keys(byGroup).length;

  // Chart data
  const funnelData = useMemo(() => {
    const stages = [
      "Identifying",
      "Site Survey",
      "Approval",
      "Equipment Ordered",
      "Installation",
      "Complete",
    ];
    return stages
      .filter((s) => byStage[s] !== undefined)
      .map((s) => ({
        name: s,
        value: byStage[s] ?? 0,
        color: STAGE_COLORS[s] ?? "#6B7280",
      }));
  }, [byStage]);

  const groupBarData = useMemo(() => {
    return Object.entries(byGroup)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [byGroup]);

  // Table columns
  const tableColumns = useMemo(
    () => [
      {
        key: "Property Name",
        label: "Property Name",
        sortable: true,
      },
      {
        key: "Stages",
        label: "Stage",
        sortable: true,
        render: (value: unknown) => {
          const stage = String(value || "");
          const badgeColor =
            STAGE_BADGE_COLORS[stage] ||
            "bg-gray-500/20 text-gray-400 border-gray-500/30";
          return stage ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {stage}
            </span>
          ) : (
            <span className="text-text-muted">--</span>
          );
        },
      },
      {
        key: "Property Group",
        label: "Property Group",
        sortable: true,
      },
      {
        key: "Machine Company",
        label: "Machine Company",
        sortable: true,
      },
      {
        key: "Rev Share Type",
        label: "Rev Share Type",
        sortable: true,
      },
    ],
    []
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              National Contracts
            </h1>
            <p className="text-sm text-text-muted">
              MSA property pipeline and group distribution
            </p>
          </div>
        </div>
      </motion.div>

      {/* ======= ROW 1: KPI Cards ======= */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Total National Properties"
              value={nationalProperties}
              icon={Building2}
              color="blue"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Active / Complete"
              value={completeCount}
              icon={CheckCircle}
              color="green"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="In Pipeline"
              value={pipelineCount}
              icon={GitBranch}
              color="amber"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Property Groups"
              value={uniqueGroups}
              icon={Map}
              color="purple"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 2: Charts ======= */}
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
            <FunnelChart
              data={funnelData}
              title="MSA Stage Pipeline"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <BarChart
              data={groupBarData}
              title="Property Group Distribution"
              color="#8B5CF6"
              layout="vertical"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 3: Data Table ======= */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-text-muted" />
          <h3 className="text-lg font-semibold text-text-primary">
            National Contracts Detail
          </h3>
          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
            {tableData.length}
          </span>
        </div>

        {tableLoading ? (
          <div className="glass-card p-6">
            <Skeleton className="h-8 w-full mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={tableData}
            searchable
            pageSize={10}
          />
        )}
      </motion.div>
    </div>
  );
}
