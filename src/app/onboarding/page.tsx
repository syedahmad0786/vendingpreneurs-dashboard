'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  GraduationCap,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface AirtableRecord {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  'Kick Off': '#3B82F6',
  Prospecting: '#8B5CF6',
  'Machine Ordered': '#F59E0B',
  'Vendhub Member': '#10B981',
};

const ERROR_TYPE_COLORS: Record<string, string> = {
  'Airtable Student Record': '#EF4444',
  'Airtable Client Record': '#F59E0B',
  'Skool Invite': '#8B5CF6',
  'Intercom Contact': '#3B82F6',
  'Close CRM Update': '#EC4899',
  'Email Validation': '#10B981',
  Unknown: '#6B7280',
  'Close CRM Fields Empty': '#F97316',
};

const STATUS_COLORS: Record<string, { fill: string; label: string }> = {
  New: { fill: '#EF4444', label: 'New' },
  Investigating: { fill: '#F59E0B', label: 'Investigating' },
  Resolved: { fill: '#10B981', label: 'Resolved' },
  Ignored: { fill: '#6B7280', label: 'Ignored' },
};

const stagger = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: "easeOut" as const },
  }),
};

// ─── Toast System ─────────────────────────────────────────────────────────────

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-xl shadow-2xl ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, addToast, removeToast };
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function GlassCard({ children, className = '', motionIndex = 0 }: { children: React.ReactNode; className?: string; motionIndex?: number }) {
  return (
    <motion.div custom={motionIndex} initial="hidden" animate="visible" variants={stagger} className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-7 ${className}`}>
      {children}
    </motion.div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/10 ${className}`} />;
}

function LoadingCard() {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-3">
      <SkeletonBar className="h-4 w-24" />
      <SkeletonBar className="h-8 w-16" />
      <SkeletonBar className="h-3 w-32" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    New: 'bg-red-500/20 text-red-300 border-red-500/30',
    Investigating: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Ignored: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return (
    <span className={`inline-flex items-center shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status] || 'bg-white/10 text-white/60 border-white/20'}`}>
      {status}
    </span>
  );
}

function ErrorTypeBadge({ type }: { type: string }) {
  const color = ERROR_TYPE_COLORS[type] || '#6B7280';
  return (
    <span className="inline-flex items-center shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: `${color}20`, color, borderColor: `${color}50` }}>
      {type}
    </span>
  );
}

function SortButton({ column, sortState, onSort }: { column: string; sortState: SortState; onSort: (col: string) => void }) {
  const active = sortState.column === column;
  return (
    <button onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-white/90 transition-colors">
      {active && sortState.direction === 'asc' && <ChevronUp className="w-3.5 h-3.5" />}
      {active && sortState.direction === 'desc' && <ChevronDown className="w-3.5 h-3.5" />}
      {!active && <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
    </button>
  );
}

interface ChartTooltipPayload {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-white/60 mb-1">{label}</p>
      {payload.map((p: ChartTooltipPayload, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [errorsData, setErrorsData] = useState<AirtableRecord[]>([]);
  const [studentsData, setStudentsData] = useState<AirtableRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [errorSort, setErrorSort] = useState<SortState>({ column: '', direction: null });
  const [studentSort, setStudentSort] = useState<SortState>({ column: 'Create Date', direction: 'desc' });
  const { toasts, addToast, removeToast } = useToasts();

  // ── Data Fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));

    fetch('/api/airtable?table=tblaQ6fpHGhRs56sH')
      .then((r) => r.json())
      .then((d) => setErrorsData(d.records || []))
      .catch(() => setErrorsData([]))
      .finally(() => setLoadingErrors(false));

    fetch('/api/airtable?table=tblMLFYTeoqrtmgXQ&fields=Full Name,Program Tier Purchased,Create Date,Best Email,Skool Granted,Kickoff Scheduled')
      .then((r) => r.json())
      .then((d) => setStudentsData(d.records || []))
      .catch(() => setStudentsData([]))
      .finally(() => setLoadingStudents(false));
  }, []);

  // ── KPI Derivations ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeErrors = errorsData.filter((r) => r.fields['Status'] === 'New' || r.fields['Status'] === 'Investigating').length;
    return {
      inOnboarding: stats?.onboarding?.inOnboarding ?? 0,
      pendingStudents: stats?.onboarding?.pendingStudentRecords ?? 0,
      activeErrors,
      avgDays: stats?.onboarding?.avgDaysToComplete ?? 0,
    };
  }, [stats, errorsData]);

  // ── Chart Data ──────────────────────────────────────────────────────────────
  const waterfallData = useMemo(() => {
    if (!stats?.onboarding?.phaseBreakdown) {
      return [
        { phase: 'Kick Off', count: 0 },
        { phase: 'Prospecting', count: 0 },
        { phase: 'Machine Ordered', count: 0 },
        { phase: 'Vendhub Member', count: 0 },
      ];
    }
    return Object.entries(stats.onboarding.phaseBreakdown).map(([phase, count]) => ({ phase, count: count as number }));
  }, [stats]);

  const completionTrend = useMemo(() => {
    if (stats?.onboarding?.completionTrend) return stats.onboarding.completionTrend;
    return ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((m) => ({ month: m, completed: 0 }));
  }, [stats]);

  const errorsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    errorsData.forEach((r) => { const t = r.fields['Error Type'] || 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [errorsData]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    errorsData.forEach((r) => { const s = r.fields['Status'] || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ name: status, value: count, fill: STATUS_COLORS[status]?.fill || '#6B7280' }));
  }, [errorsData]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
  const cycleSort = (prev: SortState, column: string): SortState => {
    if (prev.column === column) {
      const next = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
      return { column: next ? column : '', direction: next };
    }
    return { column, direction: 'asc' };
  };

  const handleErrorSort = useCallback((column: string) => setErrorSort((prev) => cycleSort(prev, column)), []);
  const handleStudentSort = useCallback((column: string) => setStudentSort((prev) => cycleSort(prev, column)), []);

  const sortRecords = (data: AirtableRecord[], sort: SortState, dateColumns: string[] = []) => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      const aVal = a.fields[sort.column] ?? '';
      const bVal = b.fields[sort.column] ?? '';
      if (dateColumns.includes(sort.column)) {
        const aD = new Date(aVal).getTime() || 0;
        const bD = new Date(bVal).getTime() || 0;
        return sort.direction === 'asc' ? aD - bD : bD - aD;
      }
      return sort.direction === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  };

  const sortedErrors = useMemo(() => sortRecords(errorsData, errorSort, ['Timestamp']), [errorsData, errorSort]);

  const sortedStudents = useMemo(() => {
    if (!studentSort.column || !studentSort.direction) {
      return [...studentsData].sort((a, b) => {
        const aD = new Date(a.fields['Create Date']).getTime() || 0;
        const bD = new Date(b.fields['Create Date']).getTime() || 0;
        return bD - aD;
      });
    }
    return sortRecords(studentsData, studentSort, ['Create Date', 'Kickoff Scheduled']);
  }, [studentsData, studentSort]);

  // ── Resubmit Handler ────────────────────────────────────────────────────────
  const handleResubmit = async (record: AirtableRecord) => {
    setResubmitting(record.id);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resubmit',
          payload: {
            client_id: record.fields['Lead ID'],
            full_name: record.fields['Lead Name'],
            best_email: record.fields['Email'],
            error_record_id: record.id,
            original_error: record.fields['Error Type'],
            original_execution_id: record.fields['Execution ID'],
            source: 'dashboard_resubmit',
          },
        }),
      });
      if (res.ok) {
        addToast('success', `Resubmitted ${record.fields['Lead Name'] || 'record'} successfully`);
      } else {
        const errBody = await res.json().catch(() => ({}));
        addToast('error', errBody.message || 'Resubmit failed. Please try again.');
      }
    } catch {
      addToast('error', 'Network error. Could not reach the server.');
    } finally {
      setResubmitting(null);
    }
  };

  // ── KPI Card Config ─────────────────────────────────────────────────────────
  const kpiCards = [
    { label: 'In Onboarding Now', value: kpis.inOnboarding, icon: Users, color: '#3B82F6', bg: 'from-blue-500/20 to-blue-600/5' },
    { label: 'Pending Student Records', value: kpis.pendingStudents, icon: GraduationCap, color: '#F59E0B', bg: 'from-amber-500/20 to-amber-600/5' },
    { label: 'Active Errors', value: kpis.activeErrors, icon: AlertTriangle, color: '#EF4444', bg: 'from-red-500/20 to-red-600/5' },
    { label: 'Avg Days to Complete', value: kpis.avgDays, icon: Clock, color: '#10B981', bg: 'from-emerald-500/20 to-emerald-600/5' },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Onboarding Deep Dive
              </h1>
              <p className="text-sm text-text-muted">
                Track every stage of client onboarding, resolve errors, and monitor completions
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Row 1: KPI Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {loadingStats
            ? Array.from({ length: 4 }).map((_, i) => <LoadingCard key={i} />)
            : kpiCards.map((card, i) => (
                <GlassCard key={card.label} motionIndex={i} className="relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-50`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium uppercase tracking-wider text-white/50">{card.label}</span>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}20` }}>
                        <card.icon className="w-[18px] h-[18px]" style={{ color: card.color }} />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{card.value}</p>
                  </div>
                </GlassCard>
              ))}
        </div>

        {/* ── Row 2: Stage Waterfall + Completion Trend ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Onboarding Stage Waterfall */}
          <GlassCard motionIndex={4}>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Onboarding Stage Waterfall</h2>
            {loadingStats ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={waterfallData} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="phase" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" name="Clients" radius={[8, 8, 0, 0]}>
                    {waterfallData.map((entry) => (
                      <Cell key={entry.phase} fill={PHASE_COLORS[entry.phase] || '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Onboarding Completion Trend */}
          <GlassCard motionIndex={5}>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Onboarding Completion Trend</h2>
            {loadingStats ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={completionTrend}>
                  <defs>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2.5} fill="url(#completedGrad)" dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>

        {/* ── Row 3: Errors by Type + Error Status Breakdown ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Errors by Type (Horizontal Bar) */}
          <GlassCard motionIndex={6}>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Errors by Type</h2>
            {loadingErrors ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : errorsByType.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-white/30 text-sm">No error data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, errorsByType.length * 42)}>
                <BarChart data={errorsByType} layout="vertical" barSize={20} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} width={160} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" name="Errors" radius={[0, 6, 6, 0]}>
                    {errorsByType.map((entry) => (
                      <Cell key={entry.type} fill={ERROR_TYPE_COLORS[entry.type] || '#6B7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Error Status Breakdown (Donut) */}
          <GlassCard motionIndex={7}>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Error Status Breakdown</h2>
            {loadingErrors ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : statusBreakdown.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-white/30 text-sm">No error data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value" stroke="none">
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
                          <p className="text-sm font-semibold" style={{ color: d.fill }}>{d.name}: {d.value}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(value: string) => <span className="text-xs text-white/60">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>

        {/* ── Row 4: Onboarding Errors Table ──────────────────────────────── */}
        <GlassCard motionIndex={8} className="overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Onboarding Errors</h2>
            <span className="text-xs text-white/40">{errorsData.length} record{errorsData.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingErrors ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonBar key={i} className="h-12 w-full" />)}</div>
          ) : errorsData.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No onboarding errors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      { key: 'Lead Name', label: 'Lead Name' },
                      { key: 'Error Type', label: 'Error Type' },
                      { key: 'Status', label: 'Status' },
                      { key: 'Email', label: 'Email' },
                      { key: 'Timestamp', label: 'Timestamp' },
                    ].map(({ key, label }) => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleErrorSort(key)}>
                        <span className="flex items-center gap-1.5">
                          {label}
                          <SortButton column={key} sortState={errorSort} onSort={handleErrorSort} />
                        </span>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedErrors.map((record, idx) => (
                    <motion.tr key={record.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.01, duration: 0.25 }} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white/90 whitespace-nowrap">{record.fields['Lead Name'] || '--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><ErrorTypeBadge type={record.fields['Error Type'] || 'Unknown'} /></td>
                      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={record.fields['Status'] || 'Unknown'} /></td>
                      <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">{record.fields['Email'] || '--'}</td>
                      <td className="px-6 py-4 text-sm text-white/50 whitespace-nowrap">
                        {record.fields['Timestamp'] ? new Date(record.fields['Timestamp']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleResubmit(record)} disabled={resubmitting === record.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 hover:border-blue-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                            {resubmitting === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Resubmit
                          </button>
                          <a href={`https://airtable.com/appgqED05AlPLi0ar/tblaQ6fpHGhRs56sH/${record.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Airtable
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* ── Row 5: Recent Student Onboardings ───────────────────────────── */}
        <GlassCard motionIndex={9} className="overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Recent Student Onboardings</h2>
            <span className="text-xs text-white/40">{studentsData.length} record{studentsData.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingStudents ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonBar key={i} className="h-12 w-full" />)}</div>
          ) : studentsData.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No student records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      { key: 'Full Name', label: 'Full Name' },
                      { key: 'Program Tier Purchased', label: 'Program Tier' },
                      { key: 'Create Date', label: 'Create Date' },
                      { key: 'Best Email', label: 'Email' },
                      { key: 'Skool Granted', label: 'Skool Granted' },
                      { key: 'Kickoff Scheduled', label: 'Kickoff Scheduled' },
                    ].map(({ key, label }) => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70 transition-colors" onClick={() => handleStudentSort(key)}>
                        <span className="flex items-center gap-1.5">
                          {label}
                          <SortButton column={key} sortState={studentSort} onSort={handleStudentSort} />
                        </span>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedStudents.map((record, idx) => (
                    <motion.tr key={record.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.01, duration: 0.25 }} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white/90 whitespace-nowrap">{record.fields['Full Name'] || '--'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/25">
                          {record.fields['Program Tier Purchased'] || '--'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">
                        {record.fields['Create Date'] ? new Date(record.fields['Create Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">{record.fields['Best Email'] || '--'}</td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {record.fields['Skool Granted'] ? (
                          <span className="text-emerald-400 text-base" title="Granted">&#10003;</span>
                        ) : (
                          <span className="text-red-400 text-base" title="Not Granted">&#10007;</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60 whitespace-nowrap">
                        {record.fields['Kickoff Scheduled'] ? new Date(record.fields['Kickoff Scheduled']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <a href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${record.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Lead
                        </a>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
