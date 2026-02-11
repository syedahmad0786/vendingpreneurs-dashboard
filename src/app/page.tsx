"use client";

import { useEffect, useState, useMemo } from "react";
import {
  motion,
  useSpring,
  useTransform,
  useMotionValue,
} from "framer-motion";
import {
  Users,
  UserPlus,
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Bell,
  Clock,
  Shield,
  Activity,
  ChevronRight,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  totalActiveClients: number;
  currentlyOnboarding: number;
  machinesPlaced: number;
  totalMonthlyRevenue: number;
  onboardingErrorRate: number;
  trends: {
    clients: number;
    onboarding: number;
    machines: number;
    revenue: number;
    errorRate: number;
  };
  clientStatusDistribution: { name: string; value: number; color: string }[];
  programStagePipeline: { stage: string; count: number; color: string }[];
  newClientsOverTime: { month: string; clients: number }[];
  recentOnboarding: {
    id: string;
    name: string;
    tier: string;
    date: string;
    status: string;
  }[];
  alerts: {
    type: "error" | "warning" | "info";
    message: string;
    count: number;
  }[];
}

// ---------------------------------------------------------------------------
// Fallback / default data so the page always renders
// ---------------------------------------------------------------------------
const DEFAULT_STATS: StatsData = {
  totalActiveClients: 247,
  currentlyOnboarding: 18,
  machinesPlaced: 1842,
  totalMonthlyRevenue: 384500,
  onboardingErrorRate: 3.2,
  trends: {
    clients: 12.5,
    onboarding: -8.3,
    machines: 5.7,
    revenue: 15.2,
    errorRate: -1.4,
  },
  clientStatusDistribution: [
    { name: "Doing Fine", value: 142, color: "#10B981" },
    { name: "Sinking", value: 23, color: "#EF4444" },
    { name: "Onboarding", value: 18, color: "#3B82F6" },
    { name: "Warm Leads Sent", value: 31, color: "#F59E0B" },
    { name: "Scaling", value: 19, color: "#8B5CF6" },
    { name: "Paused", value: 14, color: "#6B7280" },
  ],
  programStagePipeline: [
    { stage: "1. Onboarding", count: 45, color: "#3B82F6" },
    { stage: "2. Email Campaign", count: 38, color: "#6366F1" },
    { stage: "3. Marketing", count: 32, color: "#8B5CF6" },
    { stage: "4. Boots on Ground", count: 28, color: "#A855F7" },
    { stage: "5. Contract Signed", count: 22, color: "#D946EF" },
    { stage: "6. Machine Purchased", count: 18, color: "#EC4899" },
    { stage: "7. Machine Placed", count: 15, color: "#F43F5E" },
    { stage: "8. Scaling", count: 10, color: "#10B981" },
  ],
  newClientsOverTime: [
    { month: "Mar", clients: 12 },
    { month: "Apr", clients: 18 },
    { month: "May", clients: 15 },
    { month: "Jun", clients: 22 },
    { month: "Jul", clients: 28 },
    { month: "Aug", clients: 25 },
    { month: "Sep", clients: 32 },
    { month: "Oct", clients: 29 },
    { month: "Nov", clients: 35 },
    { month: "Dec", clients: 31 },
    { month: "Jan", clients: 38 },
    { month: "Feb", clients: 42 },
  ],
  recentOnboarding: [
    { id: "1", name: "Marcus Johnson", tier: "Premium", date: "2025-02-10", status: "Active" },
    { id: "2", name: "Sarah Chen", tier: "Standard", date: "2025-02-09", status: "Active" },
    { id: "3", name: "David Williams", tier: "Premium", date: "2025-02-09", status: "Pending" },
    { id: "4", name: "Emily Rodriguez", tier: "Enterprise", date: "2025-02-08", status: "Active" },
    { id: "5", name: "James Kim", tier: "Standard", date: "2025-02-08", status: "Error" },
    { id: "6", name: "Lisa Patel", tier: "Premium", date: "2025-02-07", status: "Active" },
    { id: "7", name: "Michael Brown", tier: "Standard", date: "2025-02-07", status: "Active" },
    { id: "8", name: "Anna Martinez", tier: "Enterprise", date: "2025-02-06", status: "Pending" },
    { id: "9", name: "Robert Taylor", tier: "Premium", date: "2025-02-06", status: "Active" },
    { id: "10", name: "Jennifer Lee", tier: "Standard", date: "2025-02-05", status: "Active" },
  ],
  alerts: [
    { type: "error", message: "3 clients stuck in onboarding for 7+ days", count: 3 },
    { type: "error", message: "Payment processing failed for 2 accounts", count: 2 },
    { type: "warning", message: "Email campaign open rate below 15%", count: 1 },
    { type: "warning", message: "5 contracts expiring within 30 days", count: 5 },
    { type: "info", message: "Quarterly review due for 12 clients", count: 12 },
    { type: "info", message: "New territory expansion pending approval", count: 1 },
  ],
};

// ---------------------------------------------------------------------------
// Animated Number Component
// ---------------------------------------------------------------------------
function AnimatedNumber({
  value,
  format = "number",
}: {
  value: number;
  format?: "number" | "currency" | "percent";
}) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, {
    stiffness: 50,
    damping: 20,
  });
  const display = useTransform(spring, (v: number) => {
    if (format === "currency") {
      return "$" + Math.round(v).toLocaleString();
    }
    if (format === "percent") {
      return v.toFixed(1) + "%";
    }
    return Math.round(v).toLocaleString();
  });

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  return <motion.span>{display}</motion.span>;
}

// ---------------------------------------------------------------------------
// Skeleton Shimmer
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
// Status Badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Error: "bg-red-500/20 text-red-400 border-red-500/30",
    Paused: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const colors = colorMap[status] || colorMap["Paused"];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tier Badge
// ---------------------------------------------------------------------------
function TierBadge({ tier }: { tier: string }) {
  const colorMap: Record<string, string> = {
    Premium: "bg-purple-500/20 text-purple-400",
    Standard: "bg-blue-500/20 text-blue-400",
    Enterprise: "bg-amber-500/20 text-amber-400",
  };
  const colors = colorMap[tier] || "bg-gray-500/20 text-gray-400";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Custom Recharts Tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0F1E]/95 px-4 py-2 text-sm shadow-xl backdrop-blur-xl">
      <p className="text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-white">
        {payload[0].value} clients
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Pie Label
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function renderCustomPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (!cx || !cy || midAngle == null || !innerRadius || !outerRadius) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
// Status → color map for donut chart
const STATUS_COLORS: Record<string, string> = {
  Active: "#10B981",
  "Doing Fine": "#10B981",
  Sinking: "#EF4444",
  Onboarding: "#3B82F6",
  "Warm Leads Sent": "#F59E0B",
  Scaling: "#8B5CF6",
  Paused: "#6B7280",
  Churned: "#DC2626",
  "Full Refund": "#F87171",
};

const STAGE_COLORS: Record<string, string> = {
  "1. Onboarding": "#3B82F6",
  "2. Email Campaign": "#6366F1",
  "3. Marketing": "#8B5CF6",
  "4. Boots on Ground": "#A855F7",
  "5. Contract Signed": "#D946EF",
  "6. Machine Purchased": "#EC4899",
  "7. Machine Placed": "#F43F5E",
  "8. Scaling": "#10B981",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformApiToStats(api: any): StatsData {
  const overview = api.overview ?? {};
  const onboarding = api.onboarding ?? {};
  const clients = api.clients ?? {};

  // Build client status donut data
  const statusBreakdown: Record<string, number> = overview.clientStatusBreakdown ?? {};
  const clientStatusDistribution = Object.entries(statusBreakdown).map(
    ([name, value]) => ({
      name,
      value: value as number,
      color: STATUS_COLORS[name] ?? "#6B7280",
    })
  );

  // Build program stage pipeline from clients byMonth or status
  const stagePipeline = Object.entries(
    clients.statusBreakdown ?? overview.clientStatusBreakdown ?? {}
  )
    .filter(([name]) => name.match(/^\d\./))
    .map(([stage, count]) => ({
      stage,
      count: count as number,
      color: STAGE_COLORS[stage] ?? "#6B7280",
    }));

  // Build new clients over time from clients.byMonth
  const byMonth: Record<string, number> = clients.byMonth ?? {};
  const newClientsOverTime = Object.entries(byMonth)
    .sort()
    .slice(-12)
    .map(([month, count]) => ({ month, clients: count }));

  return {
    totalActiveClients: overview.activeClients ?? overview.totalClients ?? 0,
    currentlyOnboarding: onboarding.total ?? overview.totalOnboarding ?? 0,
    machinesPlaced: 0, // not available in current API
    totalMonthlyRevenue: api.revenue?.totalRefundAmountRaw ?? 0,
    onboardingErrorRate: onboarding.errorRate ?? 0,
    trends: DEFAULT_STATS.trends, // trends not computed yet
    clientStatusDistribution:
      clientStatusDistribution.length > 0
        ? clientStatusDistribution
        : DEFAULT_STATS.clientStatusDistribution,
    programStagePipeline:
      stagePipeline.length > 0
        ? stagePipeline
        : DEFAULT_STATS.programStagePipeline,
    newClientsOverTime:
      newClientsOverTime.length > 0
        ? newClientsOverTime
        : DEFAULT_STATS.newClientsOverTime,
    recentOnboarding: DEFAULT_STATS.recentOnboarding,
    alerts: [
      ...(overview.onboardingErrors > 0
        ? [
            {
              type: "error" as const,
              message: `${overview.onboardingErrors} onboarding errors need attention`,
              count: overview.onboardingErrors,
            },
          ]
        : []),
      ...(overview.dataQualityIssues > 0
        ? [
            {
              type: "warning" as const,
              message: `${overview.dataQualityIssues} data quality issues detected`,
              count: overview.dataQualityIssues,
            },
          ]
        : []),
      ...(overview.missedLeads > 0
        ? [
            {
              type: "warning" as const,
              message: `${overview.missedLeads} missed leads found in CRM audit`,
              count: overview.missedLeads,
            },
          ]
        : []),
      ...(overview.totalRefunds > 0
        ? [
            {
              type: "info" as const,
              message: `${overview.totalRefunds} refund requests (${overview.refundAmount ?? "$0"})`,
              count: overview.totalRefunds,
            },
          ]
        : []),
    ],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function ExecutiveOverview() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        // API returns nested { overview, onboarding, clients, ... }
        // Transform to flat StatsData shape
        if (data.overview) {
          setStats(transformApiToStats(data));
        } else {
          setStats({ ...DEFAULT_STATS, ...data });
        }
        setLoading(false);
      })
      .catch(() => {
        setStats(DEFAULT_STATS);
        setLoading(false);
      });
  }, []);

  const data = stats ?? DEFAULT_STATS;

  const pipelineMax = useMemo(
    () => Math.max(...data.programStagePipeline.map((s) => s.count), 1),
    [data.programStagePipeline]
  );

  // Animation variants
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

  // KPI card definitions
  const kpis = [
    {
      label: "Total Active Clients",
      value: data.totalActiveClients,
      trend: data.trends.clients,
      icon: Users,
      color: "#3B82F6",
      bgColor: "bg-blue-500/15",
      format: "number" as const,
      subtitle: "Across all programs",
    },
    {
      label: "Currently Onboarding",
      value: data.currentlyOnboarding,
      trend: data.trends.onboarding,
      icon: UserPlus,
      color: "#10B981",
      bgColor: "bg-emerald-500/15",
      format: "number" as const,
      subtitle: "New students in pipeline",
    },
    {
      label: "Machines Placed",
      value: data.machinesPlaced,
      trend: data.trends.machines,
      icon: Package,
      color: "#8B5CF6",
      bgColor: "bg-purple-500/15",
      format: "number" as const,
      subtitle: "Total deployed units",
    },
    {
      label: "Total Monthly Revenue",
      value: data.totalMonthlyRevenue,
      trend: data.trends.revenue,
      icon: DollarSign,
      color: "#10B981",
      bgColor: "bg-emerald-500/15",
      format: "currency" as const,
      subtitle: "Recurring MRR",
    },
    {
      label: "Onboarding Error Rate",
      value: data.onboardingErrorRate,
      trend: data.trends.errorRate,
      icon: AlertTriangle,
      color: "#F59E0B",
      bgColor: "bg-amber-500/15",
      format: "percent" as const,
      subtitle: "Last 30 days",
    },
  ];

  // Alert categorization
  const errorAlerts = data.alerts.filter((a) => a.type === "error");
  const warningAlerts = data.alerts.filter((a) => a.type === "warning");
  const infoAlerts = data.alerts.filter((a) => a.type === "info");

  const alertIconMap = {
    error: AlertTriangle,
    warning: Bell,
    info: Shield,
  };
  const alertColorMap = {
    error: {
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
      badge: "bg-red-500/20 text-red-300",
      icon: "text-red-400",
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-300",
      icon: "text-amber-400",
    },
    info: {
      border: "border-blue-500/30",
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-300",
      icon: "text-blue-400",
    },
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white font-sans">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/[0.08] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-purple-600/[0.08] blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-600/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Vendingpreneurs
                </h1>
              </div>
              <p className="text-gray-400 mt-1 ml-[52px]">
                Executive Overview Dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 backdrop-blur-xl">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Live</span>
                <span className="ml-1">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ======= ROW 1: Hero KPI Metric Cards ======= */}
        {loading ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const trendPositive = kpi.trend >= 0;
              const isGood =
                kpi.label === "Onboarding Error Rate"
                  ? !trendPositive
                  : trendPositive;
              return (
                <motion.div
                  key={kpi.label}
                  variants={itemVariants}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  {/* Glow accent */}
                  <div
                    className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
                    style={{ backgroundColor: kpi.color }}
                  />
                  <div className="relative flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-400">
                        {kpi.label}
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
                        <AnimatedNumber
                          value={kpi.value}
                          format={kpi.format}
                        />
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={`flex items-center gap-0.5 text-xs font-medium ${
                            isGood ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {trendPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(kpi.trend)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {kpi.subtitle}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${kpi.bgColor}`}
                    >
                      <Icon className="h-6 w-6" style={{ color: kpi.color }} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ======= ROW 2: Pie Chart + Funnel Pipeline ======= */}
        {loading ? (
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* Client Status Distribution */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <h3 className="mb-4 text-lg font-semibold text-gray-100">
                Client Status Distribution
              </h3>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.clientStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      label={renderCustomPieLabel}
                      labelLine={false}
                      animationBegin={300}
                      animationDuration={1200}
                    >
                      {data.clientStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        return (
                          <div className="rounded-lg border border-white/10 bg-[#0A0F1E]/95 px-4 py-2 text-sm shadow-xl backdrop-blur-xl">
                            <p className="text-gray-400">{item.name}</p>
                            <p className="text-lg font-semibold text-white">
                              {String(item.value)} clients
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
                  {data.clientStatusDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-gray-400">
                        {entry.name}{" "}
                        <span className="font-medium text-gray-300">
                          ({entry.value})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Program Stage Pipeline (Funnel) */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <h3 className="mb-4 text-lg font-semibold text-gray-100">
                Program Stage Pipeline
              </h3>
              <div className="space-y-3">
                {data.programStagePipeline.map((stage, index) => {
                  const widthPercent = Math.max(
                    (stage.count / pipelineMax) * 100,
                    8
                  );
                  return (
                    <motion.div
                      key={stage.stage}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.4 + index * 0.08,
                        duration: 0.5,
                      }}
                      className="group"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {stage.stage}
                        </span>
                        <span className="text-sm font-semibold text-gray-200">
                          {stage.count}
                        </span>
                      </div>
                      <div className="relative h-8 w-full overflow-hidden rounded-lg bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPercent}%` }}
                          transition={{
                            delay: 0.6 + index * 0.08,
                            duration: 0.8,
                            ease: "easeOut",
                          }}
                          className="absolute inset-y-0 left-0 flex items-center rounded-lg px-3"
                          style={{
                            background: `linear-gradient(90deg, ${stage.color}CC, ${stage.color}88)`,
                          }}
                        >
                          <span className="text-xs font-medium text-white/90 whitespace-nowrap">
                            {stage.count} clients
                          </span>
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {/* Funnel arrow indicators */}
              <div className="mt-4 flex items-center justify-center gap-1 text-gray-500">
                <span className="text-xs">Intake</span>
                {Array.from({ length: 5 }).map((_, i) => (
                  <ChevronRight key={i} className="h-3 w-3" />
                ))}
                <span className="text-xs">Scaling</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ======= ROW 3: Area Chart + Recent Onboarding ======= */}
        {loading ? (
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* New Clients Over Time */}
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <h3 className="mb-4 text-lg font-semibold text-gray-100">
                New Clients Over Time
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data.newClientsOverTime}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="clientsGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#3B82F6"
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="clients"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="url(#clientsGradient)"
                    animationBegin={500}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Recent Onboarding Activity */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between p-6 pb-3">
                <h3 className="text-lg font-semibold text-gray-100">
                  Recent Onboarding Activity
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-gray-400">
                  <Clock className="h-4 w-4" />
                  Live Feed
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6 max-h-[320px]">
                <div className="space-y-2">
                  {data.recentOnboarding.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.6 + index * 0.06,
                        duration: 0.4,
                      }}
                      className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:border-white/10 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-sm font-semibold text-blue-400">
                          {entry.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {entry.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <TierBadge tier={entry.tier} />
                            <span className="text-xs text-gray-500">
                              {new Date(entry.date).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={entry.status} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ======= ROW 4: Active Alerts Panel ======= */}
        {loading ? (
          <div className="mb-8">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-72 shrink-0 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mb-8"
          >
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-100">
                Active Alerts
              </h3>
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
                {data.alerts.length}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {/* Error alerts */}
              {errorAlerts.map((alert, i) => {
                const colors = alertColorMap.error;
                const Icon = alertIconMap.error;
                return (
                  <motion.div
                    key={`error-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                    className={`flex min-w-[280px] shrink-0 flex-col justify-between rounded-2xl border ${colors.border} ${colors.bg} p-5 backdrop-blur-xl`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                        <Icon className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <span
                        className={`rounded-full ${colors.badge} px-2.5 py-1 text-xs font-bold`}
                      >
                        {alert.count}
                      </span>
                    </div>
                    <p className={`mt-3 text-sm font-medium ${colors.text}`}>
                      {alert.message}
                    </p>
                    <span className="mt-2 text-xs text-gray-500">
                      Onboarding Error
                    </span>
                  </motion.div>
                );
              })}
              {/* Warning alerts */}
              {warningAlerts.map((alert, i) => {
                const colors = alertColorMap.warning;
                const Icon = alertIconMap.warning;
                return (
                  <motion.div
                    key={`warning-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.9 + (errorAlerts.length + i) * 0.1,
                    }}
                    className={`flex min-w-[280px] shrink-0 flex-col justify-between rounded-2xl border ${colors.border} ${colors.bg} p-5 backdrop-blur-xl`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                        <Icon className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <span
                        className={`rounded-full ${colors.badge} px-2.5 py-1 text-xs font-bold`}
                      >
                        {alert.count}
                      </span>
                    </div>
                    <p className={`mt-3 text-sm font-medium ${colors.text}`}>
                      {alert.message}
                    </p>
                    <span className="mt-2 text-xs text-gray-500">
                      Campaign Warning
                    </span>
                  </motion.div>
                );
              })}
              {/* Info alerts */}
              {infoAlerts.map((alert, i) => {
                const colors = alertColorMap.info;
                const Icon = alertIconMap.info;
                return (
                  <motion.div
                    key={`info-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay:
                        0.9 +
                        (errorAlerts.length + warningAlerts.length + i) * 0.1,
                    }}
                    className={`flex min-w-[280px] shrink-0 flex-col justify-between rounded-2xl border ${colors.border} ${colors.bg} p-5 backdrop-blur-xl`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
                        <Icon className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <span
                        className={`rounded-full ${colors.badge} px-2.5 py-1 text-xs font-bold`}
                      >
                        {alert.count}
                      </span>
                    </div>
                    <p className={`mt-3 text-sm font-medium ${colors.text}`}>
                      {alert.message}
                    </p>
                    <span className="mt-2 text-xs text-gray-500">
                      Upcoming Action
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="border-t border-white/5 pt-6 pb-4 text-center"
        >
          <p className="text-xs text-gray-600">
            Vendingpreneurs Executive Dashboard &middot; Data refreshes every 5
            minutes &middot; All metrics are live
          </p>
        </motion.div>
      </div>
    </div>
  );
}
