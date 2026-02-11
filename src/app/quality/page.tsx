"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  UserX,
  Clock,
  ShieldCheck,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  FileWarning,
} from "lucide-react";
import MetricCard from "@/components/cards/MetricCard";
import BarChart from "@/components/charts/BarChart";
import DataTable from "@/components/tables/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StatsData {
  dataQualityIssues: number;
  missedLeadsCount: number;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------
const STATUS_BADGE: Record<string, string> = {
  New: "bg-red-500/20 text-red-400 border-red-500/30",
  Investigating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Ignored: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Open: "bg-red-500/20 text-red-400 border-red-500/30",
  Closed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
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
export default function QualityPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [qualityRecords, setQualityRecords] = useState<
    Record<string, unknown>[]
  >([]);
  const [missedLeadsRecords, setMissedLeadsRecords] = useState<
    Record<string, unknown>[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [missedLoading, setMissedLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Fetch stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        // API returns nested { overview, quality, ... }
        const q = data.quality ?? {};
        const ov = data.overview ?? {};
        setStats({
          dataQualityIssues: q.dataQualityIssues ?? ov.dataQualityIssues ?? 0,
          missedLeadsCount: q.missedLeads ?? ov.missedLeads ?? 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch data quality records
  useEffect(() => {
    fetch(
      "/api/airtable?table=dataQuality&fields=Issue Type,Status,Client Name,Description"
    )
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.records || []).map((r: AirtableRecord) => ({
          id: r.id,
          "Issue Type": r.fields["Issue Type"] ?? "",
          Status: r.fields["Status"] ?? "",
          "Client Name": r.fields["Client Name"] ?? "",
          Description: r.fields["Description"] ?? "",
        }));
        setQualityRecords(rows);
        setQualityLoading(false);
      })
      .catch(() => setQualityLoading(false));
  }, []);

  // Fetch missed leads records
  useEffect(() => {
    fetch(
      "/api/airtable?table=missedLeads&fields=Lead Name,Source,Reason,Date,Status"
    )
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.records || []).map((r: AirtableRecord) => ({
          id: r.id,
          "Lead Name": r.fields["Lead Name"] ?? "",
          Source: r.fields["Source"] ?? "",
          Reason: r.fields["Reason"] ?? "",
          Date: r.fields["Date"] ?? "",
          Status: r.fields["Status"] ?? "",
        }));
        setMissedLeadsRecords(rows);
        setMissedLoading(false);
      })
      .catch(() => setMissedLoading(false));
  }, []);

  // Trigger audit action
  const handleTriggerAudit = useCallback(async () => {
    setAuditRunning(true);
    setAuditResult(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "audit" }),
      });
      const data = await res.json();
      setAuditResult({
        success: data.success ?? res.ok,
        message: data.message ?? "Audit completed",
      });
    } catch {
      setAuditResult({
        success: false,
        message: "Failed to trigger audit. Please try again.",
      });
    } finally {
      setAuditRunning(false);
    }
  }, []);

  // Derived KPIs
  const dataQualityIssues = stats?.dataQualityIssues ?? 0;
  const missedLeadsCount = stats?.missedLeadsCount ?? 0;

  // Group quality records by Issue Type for chart
  const issueTypeBarData = useMemo(() => {
    const counts: Record<string, number> = {};
    qualityRecords.forEach((r) => {
      const type = String(r["Issue Type"] || "Unknown");
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [qualityRecords]);

  // Quality table columns
  const qualityColumns = useMemo(
    () => [
      {
        key: "Issue Type",
        label: "Issue Type",
        sortable: true,
        render: (value: unknown) => {
          const type = String(value || "");
          return (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <FileWarning className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-text-secondary">{type || "--"}</span>
            </span>
          );
        },
      },
      {
        key: "Status",
        label: "Status",
        sortable: true,
        render: (value: unknown) => {
          const status = String(value || "");
          const badgeColor =
            STATUS_BADGE[status] ||
            "bg-gray-500/20 text-gray-400 border-gray-500/30";
          return status ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {status}
            </span>
          ) : (
            <span className="text-text-muted">--</span>
          );
        },
      },
      {
        key: "Client Name",
        label: "Client",
        sortable: true,
      },
      {
        key: "Description",
        label: "Description",
        sortable: false,
        render: (value: unknown) => {
          const desc = String(value || "");
          return (
            <span
              className="text-text-muted max-w-[300px] truncate block"
              title={desc}
            >
              {desc || "--"}
            </span>
          );
        },
      },
    ],
    []
  );

  // Missed leads table columns
  const missedLeadsColumns = useMemo(
    () => [
      {
        key: "Lead Name",
        label: "Lead Name",
        sortable: true,
      },
      {
        key: "Source",
        label: "Source",
        sortable: true,
      },
      {
        key: "Reason",
        label: "Reason",
        sortable: true,
        render: (value: unknown) => {
          const reason = String(value || "");
          return (
            <span className="text-text-muted max-w-[250px] truncate block" title={reason}>
              {reason || "--"}
            </span>
          );
        },
      },
      {
        key: "Date",
        label: "Date",
        sortable: true,
        render: (value: unknown) => {
          const dateStr = String(value || "");
          if (!dateStr) return <span className="text-text-muted">--</span>;
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? (
            <span className="text-text-muted">{dateStr}</span>
          ) : (
            <span className="text-text-secondary">
              {d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          );
        },
      },
      {
        key: "Status",
        label: "Status",
        sortable: true,
        render: (value: unknown) => {
          const status = String(value || "");
          const badgeColor =
            STATUS_BADGE[status] ||
            "bg-gray-500/20 text-gray-400 border-gray-500/30";
          return status ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-amber-600">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Data Quality & Audit
            </h1>
            <p className="text-sm text-text-muted">
              Track data quality issues, missed leads, and run system audits
            </p>
          </div>
        </div>
      </motion.div>

      {/* ======= ROW 1: KPI Cards ======= */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Data Quality Issues"
              value={dataQualityIssues}
              icon={AlertTriangle}
              color="red"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Missed Leads"
              value={missedLeadsCount}
              icon={UserX}
              color="amber"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MetricCard
              title="Last Audit Run"
              value="Auto (Daily 6AM)"
              icon={Clock}
              color="blue"
            />
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 2: Chart + Audit Button ======= */}
      {loading && qualityLoading ? (
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
          {/* Quality Issues by Type Chart */}
          <motion.div variants={itemVariants}>
            <BarChart
              data={issueTypeBarData}
              title="Quality Issues by Type"
              color="#EF4444"
              layout="vertical"
            />
          </motion.div>

          {/* Trigger Audit Action */}
          <motion.div
            variants={itemVariants}
            className="glass-card p-6 flex flex-col"
          >
            <h3 className="text-sm font-semibold text-text-secondary mb-6">
              System Audit
            </h3>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-text-primary font-medium mb-1">
                  Run Data Quality Audit
                </p>
                <p className="text-text-muted text-sm max-w-xs">
                  Scans all records for missing data, duplicates, and
                  inconsistencies. Runs automatically daily at 6 AM.
                </p>
              </div>
              <button
                onClick={handleTriggerAudit}
                disabled={auditRunning}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold
                  transition-all duration-300 shadow-lg
                  ${
                    auditRunning
                      ? "bg-primary/30 text-primary/60 cursor-not-allowed"
                      : "bg-primary hover:bg-primary-dark text-white hover:shadow-primary/30 hover:shadow-xl active:scale-[0.97]"
                  }
                `}
              >
                {auditRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Audit...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Trigger Audit Now
                  </>
                )}
              </button>

              {/* Audit result feedback */}
              {auditResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border ${
                    auditResult.success
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}
                >
                  {auditResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {auditResult.message}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ======= ROW 3: Two Data Tables ======= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Data Quality Issues Table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-danger" />
            <h3 className="text-lg font-semibold text-text-primary">
              Data Quality Issues
            </h3>
            <span className="rounded-full bg-danger/20 px-2.5 py-0.5 text-xs font-medium text-danger">
              {qualityRecords.length}
            </span>
          </div>

          {qualityLoading ? (
            <div className="glass-card p-6">
              <Skeleton className="h-8 w-full mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={qualityColumns}
              data={qualityRecords}
              searchable
              pageSize={10}
            />
          )}
        </motion.div>

        {/* Missed Leads Table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <UserX className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-semibold text-text-primary">
              Missed Leads
            </h3>
            <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning">
              {missedLeadsRecords.length}
            </span>
          </div>

          {missedLoading ? (
            <div className="glass-card p-6">
              <Skeleton className="h-8 w-full mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={missedLeadsColumns}
              data={missedLeadsRecords}
              searchable
              pageSize={10}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
