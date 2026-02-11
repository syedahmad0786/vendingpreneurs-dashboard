"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Cpu,
  BarChart3,
  Wallet,
} from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";
import DataTable from "@/components/tables/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  totalRevenue: number;
  totalNetRevenue: number;
  totalClients: number;
  totalMachines: number;
  clientsByMembership: Record<string, number>;
  newClientsPerMonth: { month: string; count: number }[];
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Membership badge colors
// ---------------------------------------------------------------------------
const MEMBERSHIP_BADGE: Record<string, string> = {
  Premium: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Standard: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Basic: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  VIP: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
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
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function RevenuePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  // Fetch stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        // API returns nested { overview, clients, revenue, ... }
        const ov = data.overview ?? {};
        const cl = data.clients ?? {};
        const rv = data.revenue ?? {};
        setStats({
          totalRevenue: ov.totalRevenueRaw ?? rv.totalRevenue ?? 0,
          totalNetRevenue: ov.totalNetRevenueRaw ?? rv.totalNetRevenue ?? 0,
          totalClients: cl.total ?? ov.totalClients ?? 0,
          totalMachines: ov.totalMachines ?? rv.totalMachines ?? 0,
          clientsByMembership: cl.membershipBreakdown ?? ov.membershipLevelBreakdown ?? {},
          newClientsPerMonth: Object.entries(cl.byMonth ?? {})
            .sort()
            .slice(-12)
            .map(([month, count]) => ({ month, count: count as number })),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch top clients table data
  useEffect(() => {
    fetch(
      "/api/airtable?table=clients&fields=Full Name,Total Monthly Revenue,Total Net Revenue,Total Number of Machines,Membership Level,Status&maxRecords=50&sort=Total Monthly Revenue:desc"
    )
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.records || [])
          .map((r: AirtableRecord) => ({
            id: r.id,
            "Full Name": r.fields["Full Name"] ?? "",
            "Monthly Revenue": Number(r.fields["Total Monthly Revenue"] ?? 0),
            "Net Revenue": Number(r.fields["Total Net Revenue"] ?? 0),
            Machines: Number(r.fields["Total Number of Machines"] ?? 0),
            "Membership Level": r.fields["Membership Level"] ?? "",
            Status: r.fields["Status"] ?? "",
          }))
          .filter(
            (row: Record<string, unknown>) =>
              Number(row["Monthly Revenue"]) > 0
          );
        setTableData(rows);
        setTableLoading(false);
      })
      .catch(() => setTableLoading(false));
  }, []);

  // Derived KPIs
  const totalNetRevenue = stats?.totalNetRevenue ?? 0;
  const totalRevenue = stats?.totalRevenue ?? 0;
  const totalClients = stats?.totalClients ?? 1;
  const avgRevenuePerClient = Math.round(totalRevenue / totalClients);
  const totalMachines = stats?.totalMachines ?? 0;
  const membershipData = useMemo(() => stats?.clientsByMembership ?? {}, [stats?.clientsByMembership]);

  // Chart data: Membership level bar chart
  const membershipBarData = useMemo(() => {
    return Object.entries(membershipData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [membershipData]);

  // Chart data: Revenue trend from monthly data
  const revenueTrendData = useMemo(() => {
    const monthly = stats?.newClientsPerMonth ?? [];
    return monthly.map((m) => ({
      name: m.month,
      revenue: m.count * avgRevenuePerClient, // approximate
    }));
  }, [stats?.newClientsPerMonth, avgRevenuePerClient]);

  // Format currency
  const formatCurrency = (val: unknown) => {
    const num = Number(val) || 0;
    return `$${num.toLocaleString()}`;
  };

  // Table columns
  const tableColumns = useMemo(
    () => [
      {
        key: "Full Name",
        label: "Client",
        sortable: true,
      },
      {
        key: "Monthly Revenue",
        label: "Monthly Revenue",
        sortable: true,
        render: (value: unknown) => (
          <span className="font-medium text-emerald-400">
            {formatCurrency(value)}
          </span>
        ),
      },
      {
        key: "Net Revenue",
        label: "Net Revenue",
        sortable: true,
        render: (value: unknown) => (
          <span className="text-text-secondary">{formatCurrency(value)}</span>
        ),
      },
      {
        key: "Machines",
        label: "Machines",
        sortable: true,
      },
      {
        key: "Membership Level",
        label: "Membership",
        sortable: true,
        render: (value: unknown) => {
          const level = String(value || "");
          const badgeColor =
            MEMBERSHIP_BADGE[level] ||
            "bg-gray-500/20 text-gray-400 border-gray-500/30";
          return level ? (
            <span
              className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {level}
            </span>
          ) : (
            <span className="text-text-muted">--</span>
          );
        },
      },
      {
        key: "Status",
        label: "Status",
        sortable: true,
        render: (value: unknown) => {
          const status = String(value || "");
          const statusColors: Record<string, string> = {
            "Doing Fine":
              "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            Sinking: "bg-red-500/20 text-red-400 border-red-500/30",
            Onboarding: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            Scaling: "bg-purple-500/20 text-purple-400 border-purple-500/30",
            Paused: "bg-gray-500/20 text-gray-400 border-gray-500/30",
          };
          const badgeColor =
            statusColors[status] ||
            "bg-gray-500/20 text-gray-400 border-gray-500/30";
          return status ? (
            <span
              className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {status}
            </span>
          ) : (
            <span className="text-text-muted">--</span>
          );
        },
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Revenue & Financial
            </h1>
            <p className="text-sm text-text-muted">
              Revenue metrics, membership breakdown, and top-performing clients
            </p>
          </div>
        </div>
      </motion.div>

      {/* ======= ROW 1: KPI Cards ======= */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4"
        >
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Total Net Revenue"
              value={totalNetRevenue}
              icon={DollarSign}
              color="green"
              prefix="$"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Avg Revenue Per Client"
              value={avgRevenuePerClient}
              icon={TrendingUp}
              color="blue"
              prefix="$"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Total Machines Placed"
              value={totalMachines}
              icon={Cpu}
              color="purple"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Monthly Revenue"
              value={totalRevenue}
              icon={BarChart3}
              color="amber"
              prefix="$"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 2: Charts ======= */}
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
            <BarChart
              data={membershipBarData}
              title="Clients by Membership Level"
              color="#8B5CF6"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <LineChart
              data={revenueTrendData}
              title="Revenue Trend (Estimated)"
              dataKeys={[
                { key: "revenue", color: "#10B981", name: "Revenue" },
              ]}
              areaFill
            />
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 3: Top Clients Table ======= */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-text-muted" />
          <h3 className="text-lg font-semibold text-text-primary">
            Top Revenue Clients
          </h3>
          <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
            {tableData.length}
          </span>
        </div>

        {tableLoading ? (
          <div className="glass-card p-6 sm:p-7">
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
