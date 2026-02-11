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
  Search,
  ChevronLeft,
  ChevronRight,
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

const PAGE_SIZE = 10;

function cycleSort(prev: SortState, column: string): SortState {
  if (prev.column === column) {
    const next = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
    return { column: next ? column : '', direction: next };
  }
  return { column, direction: 'asc' };
}

function sortRecords(data: AirtableRecord[], sort: SortState, dateColumns: string[] = []) {
  if (!sort.column || !sort.direction) return data;
  return [...data].sort((a, b) => {
    const aVal = a.fields[sort.column] ?? '';
    const bVal = b.fields[sort.column] ?? '';
    if (dateColumns.includes(sort.column)) {
      const aD = new Date(aVal as string).getTime() || 0;
      const bD = new Date(bVal as string).getTime() || 0;
      return sort.direction === 'asc' ? aD - bD : bD - aD;
    }
    return sort.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Toast System ─────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-[min(380px,calc(100vw-2rem))]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/20 text-emerald-300 backdrop-blur-xl'
                : 'bg-red-950/80 border-red-500/20 text-red-300 backdrop-blur-xl'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium leading-snug">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
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

function SectionCard({
  children,
  className = '',
  motionIndex = 0,
}: {
  children: React.ReactNode;
  className?: string;
  motionIndex?: number;
}) {
  return (
    <motion.div
      custom={motionIndex}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className={`glass-card p-5 sm:p-7 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h2>
        {count !== undefined && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-text-muted border border-white/10 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function LoadingKPI() {
  return (
    <div className="glass-card p-6 sm:p-7">
      <div className="flex items-start justify-between mb-5">
        <SkeletonBar className="h-3.5 w-24" />
        <SkeletonBar className="h-10 w-10 rounded-xl" />
      </div>
      <SkeletonBar className="h-9 w-20 mb-2" />
      <SkeletonBar className="h-3 w-28" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    New: 'bg-red-500/10 text-red-400 border-red-500/20',
    Investigating: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Ignored: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return (
    <span
      className={`inline-flex items-center shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
        map[status] || 'bg-white/5 text-text-muted border-white/10'
      }`}
    >
      {status}
    </span>
  );
}

function ErrorTypeBadge({ type }: { type: string }) {
  const color = ERROR_TYPE_COLORS[type] || '#6B7280';
  return (
    <span
      className="inline-flex items-center shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
      style={{ backgroundColor: `${color}10`, color, borderColor: `${color}25` }}
    >
      {type}
    </span>
  );
}

function SortButton({
  column,
  sortState,
  onSort,
}: {
  column: string;
  sortState: SortState;
  onSort: (col: string) => void;
}) {
  const active = sortState.column === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
      aria-label={`Sort by ${column}`}
    >
      {active && sortState.direction === 'asc' && <ChevronUp className="w-3.5 h-3.5 text-primary" />}
      {active && sortState.direction === 'desc' && <ChevronDown className="w-3.5 h-3.5 text-primary" />}
      {!active && <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />}
    </button>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] text-text-muted mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function ActionButton({
  onClick,
  disabled,
  loading,
  variant = 'primary',
  icon: Icon,
  label,
  href,
}: {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
  icon: React.ElementType;
  label: string;
  href?: string;
}) {
  const base =
    'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30',
    ghost: 'bg-white/[0.03] text-text-secondary border border-white/[0.06] hover:bg-white/[0.06] hover:text-text-primary',
  };

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${base} ${variants[variant]}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{label}</span>
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]}`}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ─── Mobile Card Components ──────────────────────────────────────────────────

function ErrorMobileCard({
  record,
  resubmitting,
  onResubmit,
}: {
  record: AirtableRecord;
  resubmitting: string | null;
  onResubmit: (record: AirtableRecord) => void;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary truncate">
            {record.fields['Lead Name'] || '--'}
          </p>
          <p className="text-xs text-text-muted mt-1 truncate">{record.fields['Email'] || '--'}</p>
        </div>
        <StatusBadge status={record.fields['Status'] || 'Unknown'} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ErrorTypeBadge type={record.fields['Error Type'] || 'Unknown'} />
        <span className="text-[11px] text-text-muted">
          {record.fields['Timestamp']
            ? new Date(record.fields['Timestamp']).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '--'}
        </span>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
        <ActionButton
          onClick={() => onResubmit(record)}
          disabled={resubmitting === record.id}
          loading={resubmitting === record.id}
          icon={RefreshCw}
          label="Resubmit"
          variant="primary"
        />
        <ActionButton
          href={`https://airtable.com/appgqED05AlPLi0ar/tblaQ6fpHGhRs56sH/${record.id}`}
          icon={ExternalLink}
          label="Airtable"
          variant="ghost"
        />
      </div>
    </div>
  );
}

function StudentMobileCard({ record }: { record: AirtableRecord }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary truncate">
            {record.fields['Full Name'] || '--'}
          </p>
          <p className="text-xs text-text-muted mt-1 truncate">{record.fields['Best Email'] || '--'}</p>
        </div>
        <span className="inline-flex items-center shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
          {record.fields['Program Tier Purchased'] || '--'}
        </span>
      </div>
      <div className="flex items-center gap-5 text-[11px] text-text-muted">
        <span>
          {'Created: '}
          {record.fields['Create Date']
            ? new Date(record.fields['Create Date']).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '--'}
        </span>
        <span className="flex items-center gap-1.5">
          {'Skool: '}
          {record.fields['Skool Granted'] ? (
            <span className="text-emerald-400 font-bold">{'✓'}</span>
          ) : (
            <span className="text-red-400 font-bold">{'✕'}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-5 text-[11px] text-text-muted">
        <span>
          {'Kickoff: '}
          {record.fields['Kickoff Scheduled']
            ? new Date(record.fields['Kickoff Scheduled']).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '--'}
        </span>
      </div>
      <div className="pt-1 border-t border-white/[0.04]">
        <ActionButton
          href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${record.id}`}
          icon={ExternalLink}
          label="Open Lead"
          variant="ghost"
        />
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize: ps,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const safePage = Math.min(currentPage, totalPages);
  return (
    <div className="flex items-center justify-between pt-5 border-t border-white/[0.04]">
      <p className="text-xs text-text-muted tabular-nums">
        {(safePage - 1) * ps + 1}&ndash;{Math.min(safePage * ps, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) page = i + 1;
          else if (safePage <= 3) page = i + 1;
          else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
          else page = safePage - 2 + i;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200 ${
                page === safePage
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [errorsData, setErrorsData] = useState<AirtableRecord[]>([]);
  const [studentsData, setStudentsData] = useState<AirtableRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [errorSort, setErrorSort] = useState<SortState>({ column: '', direction: null });
  const [studentSort, setStudentSort] = useState<SortState>({ column: 'Create Date', direction: 'desc' });
  const [errorSearch, setErrorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [errorPage, setErrorPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
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
    const activeErrors = errorsData.filter(
      (r) => r.fields['Status'] === 'New' || r.fields['Status'] === 'Investigating'
    ).length;
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
    return Object.entries(stats.onboarding.phaseBreakdown).map(([phase, count]) => ({
      phase,
      count: count as number,
    }));
  }, [stats]);

  const completionTrend = useMemo(() => {
    if (stats?.onboarding?.completionTrend) return stats.onboarding.completionTrend;
    return ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((m) => ({ month: m, completed: 0 }));
  }, [stats]);

  const errorsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    errorsData.forEach((r) => {
      const t = r.fields['Error Type'] || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [errorsData]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    errorsData.forEach((r) => {
      const s = r.fields['Status'] || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: status,
      value: count,
      fill: STATUS_COLORS[status]?.fill || '#6B7280',
    }));
  }, [errorsData]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
  const handleErrorSort = useCallback((column: string) => {
    setErrorSort((prev) => cycleSort(prev, column));
    setErrorPage(1);
  }, []);

  const handleStudentSort = useCallback((column: string) => {
    setStudentSort((prev) => cycleSort(prev, column));
    setStudentPage(1);
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredErrors = useMemo(() => {
    if (!errorSearch.trim()) return errorsData;
    const term = errorSearch.toLowerCase();
    return errorsData.filter(
      (r) =>
        (r.fields['Lead Name'] || '').toLowerCase().includes(term) ||
        (r.fields['Email'] || '').toLowerCase().includes(term) ||
        (r.fields['Error Type'] || '').toLowerCase().includes(term)
    );
  }, [errorsData, errorSearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsData;
    const term = studentSearch.toLowerCase();
    return studentsData.filter(
      (r) =>
        (r.fields['Full Name'] || '').toLowerCase().includes(term) ||
        (r.fields['Best Email'] || '').toLowerCase().includes(term) ||
        (r.fields['Program Tier Purchased'] || '').toLowerCase().includes(term)
    );
  }, [studentsData, studentSearch]);

  const sortedErrors = useMemo(
    () => sortRecords(filteredErrors, errorSort, ['Timestamp']),
    [filteredErrors, errorSort]
  );

  const sortedStudents = useMemo(() => {
    if (!studentSort.column || !studentSort.direction) {
      return [...filteredStudents].sort((a, b) => {
        const aD = new Date(a.fields['Create Date']).getTime() || 0;
        const bD = new Date(b.fields['Create Date']).getTime() || 0;
        return bD - aD;
      });
    }
    return sortRecords(filteredStudents, studentSort, ['Create Date', 'Kickoff Scheduled']);
  }, [filteredStudents, studentSort]);

  // ── Pagination slicing ──────────────────────────────────────────────────────
  const errorTotalPages = Math.max(1, Math.ceil(sortedErrors.length / PAGE_SIZE));
  const paginatedErrors = sortedErrors.slice((errorPage - 1) * PAGE_SIZE, errorPage * PAGE_SIZE);

  const studentTotalPages = Math.max(1, Math.ceil(sortedStudents.length / PAGE_SIZE));
  const paginatedStudents = sortedStudents.slice(
    (studentPage - 1) * PAGE_SIZE,
    studentPage * PAGE_SIZE
  );

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
    {
      label: 'In Onboarding',
      value: kpis.inOnboarding,
      icon: Users,
      color: '#3B82F6',
      bgClass: 'bg-primary/15',
      textClass: 'text-primary-light',
      glowClass: 'glow-blue',
    },
    {
      label: 'Pending Records',
      value: kpis.pendingStudents,
      icon: GraduationCap,
      color: '#F59E0B',
      bgClass: 'bg-warning/15',
      textClass: 'text-warning-light',
      glowClass: 'glow-amber',
    },
    {
      label: 'Active Errors',
      value: kpis.activeErrors,
      icon: AlertTriangle,
      color: '#EF4444',
      bgClass: 'bg-danger/15',
      textClass: 'text-danger-light',
      glowClass: 'glow-red',
    },
    {
      label: 'Avg Days to Complete',
      value: kpis.avgDays,
      icon: Clock,
      color: '#10B981',
      bgClass: 'bg-success/15',
      textClass: 'text-success-light',
      glowClass: 'glow-green',
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-4"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#06B6D4] shadow-lg shadow-primary/20">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-text-primary text-balance">
            Onboarding Deep Dive
          </h1>
          <p className="text-sm text-text-muted leading-relaxed mt-0.5">
            Track every stage of client onboarding, resolve errors, and monitor completions
          </p>
        </div>
      </motion.header>

      {/* ── Row 1: KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => <LoadingKPI key={i} />)
          : kpiCards.map((card, i) => (
              <motion.div
                key={card.label}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                className={`glass-card p-6 sm:p-7 cursor-default transition-shadow duration-300 ${card.glowClass}`}
              >
                <div className="flex items-start justify-between mb-5">
                  <span className="text-xs font-medium text-text-muted leading-snug">
                    {card.label}
                  </span>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.bgClass}`}
                  >
                    <card.icon className={`w-5 h-5 ${card.textClass}`} />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight tabular-nums">
                  {card.value}
                </p>
              </motion.div>
            ))}
      </div>

      {/* ── Row 2: Stage Waterfall + Completion Trend ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {/* Onboarding Stage Waterfall */}
        <SectionCard motionIndex={4}>
          <SectionHeader title="Onboarding Stage Waterfall" />
          {loadingStats ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-2 px-2">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={waterfallData}
                    barSize={40}
                    margin={{ left: -8, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="phase"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="count" name="Clients" radius={[8, 8, 0, 0]}>
                      {waterfallData.map((entry) => (
                        <Cell key={entry.phase} fill={PHASE_COLORS[entry.phase] || '#3B82F6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Completion Trend */}
        <SectionCard motionIndex={5}>
          <SectionHeader title="Completion Trend" />
          {loadingStats ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-2 px-2">
              <div className="min-w-[300px]">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={completionTrend}
                    margin={{ left: -8, right: 12, top: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Completed"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#completedGrad)"
                      dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Row 3: Errors by Type + Error Status Breakdown ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {/* Errors by Type */}
        <SectionCard motionIndex={6}>
          <SectionHeader title="Errors by Type" />
          {loadingErrors ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : errorsByType.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-text-muted">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No error data available</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-2 px-2">
              <div className="min-w-[340px]">
                <ResponsiveContainer width="100%" height={Math.max(280, errorsByType.length * 44)}>
                  <BarChart
                    data={errorsByType}
                    layout="vertical"
                    barSize={22}
                    margin={{ left: 0, right: 12, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="type"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                      tickLine={false}
                      width={135}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="count" name="Errors" radius={[0, 6, 6, 0]}>
                      {errorsByType.map((entry) => (
                        <Cell key={entry.type} fill={ERROR_TYPE_COLORS[entry.type] || '#6B7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Error Status Breakdown */}
        <SectionCard motionIndex={7}>
          <SectionHeader title="Error Status Breakdown" />
          {loadingErrors ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : statusBreakdown.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-text-muted">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No error data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-strong rounded-xl px-4 py-3 shadow-2xl">
                        <p className="text-sm font-semibold" style={{ color: d.fill }}>
                          {d.name}: {d.value}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={40}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => (
                    <span className="text-xs text-text-muted">{String(value)}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* ── Row 4: Onboarding Errors Table ──────────────────────────────── */}
      <SectionCard motionIndex={8}>
        <SectionHeader title="Onboarding Errors" count={filteredErrors.length}>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search errors..."
              value={errorSearch}
              onChange={(e) => {
                setErrorSearch(e.target.value);
                setErrorPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </SectionHeader>

        {loadingErrors ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredErrors.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{errorSearch ? 'No matching errors found' : 'No onboarding errors found'}</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="flex flex-col gap-3 md:hidden">
              {paginatedErrors.map((record) => (
                <ErrorMobileCard
                  key={record.id}
                  record={record}
                  resubmitting={resubmitting}
                  onResubmit={handleResubmit}
                />
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-7">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {[
                      { key: 'Lead Name', label: 'Lead Name' },
                      { key: 'Error Type', label: 'Error Type' },
                      { key: 'Status', label: 'Status' },
                      { key: 'Email', label: 'Email' },
                      { key: 'Timestamp', label: 'Timestamp' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-5 lg:px-7 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                        onClick={() => handleErrorSort(key)}
                      >
                        <span className="flex items-center gap-1.5">
                          {label}
                          <SortButton column={key} sortState={errorSort} onSort={handleErrorSort} />
                        </span>
                      </th>
                    ))}
                    <th className="px-5 lg:px-7 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {paginatedErrors.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 lg:px-7 py-4 text-sm font-medium text-text-primary whitespace-nowrap max-w-[180px] truncate">
                        {record.fields['Lead Name'] || '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 whitespace-nowrap">
                        <ErrorTypeBadge type={record.fields['Error Type'] || 'Unknown'} />
                      </td>
                      <td className="px-5 lg:px-7 py-4 whitespace-nowrap">
                        <StatusBadge status={record.fields['Status'] || 'Unknown'} />
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-sm text-text-secondary whitespace-nowrap max-w-[200px] truncate">
                        {record.fields['Email'] || '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-sm text-text-muted whitespace-nowrap">
                        {record.fields['Timestamp']
                          ? new Date(record.fields['Timestamp']).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ActionButton
                            onClick={() => handleResubmit(record)}
                            disabled={resubmitting === record.id}
                            loading={resubmitting === record.id}
                            icon={RefreshCw}
                            label="Resubmit"
                            variant="primary"
                          />
                          <ActionButton
                            href={`https://airtable.com/appgqED05AlPLi0ar/tblaQ6fpHGhRs56sH/${record.id}`}
                            icon={ExternalLink}
                            label="Airtable"
                            variant="ghost"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={errorPage}
              totalPages={errorTotalPages}
              totalItems={sortedErrors.length}
              pageSize={PAGE_SIZE}
              onPageChange={setErrorPage}
            />
          </>
        )}
      </SectionCard>

      {/* ── Row 5: Recent Student Onboardings ───────────────────────────── */}
      <SectionCard motionIndex={9}>
        <SectionHeader title="Recent Student Onboardings" count={filteredStudents.length}>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search students..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setStudentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </SectionHeader>

        {loadingStudents ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {studentSearch ? 'No matching students found' : 'No student records found'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="flex flex-col gap-3 md:hidden">
              {paginatedStudents.map((record) => (
                <StudentMobileCard key={record.id} record={record} />
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-7">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {[
                      { key: 'Full Name', label: 'Full Name' },
                      { key: 'Program Tier Purchased', label: 'Program Tier' },
                      { key: 'Create Date', label: 'Created' },
                      { key: 'Best Email', label: 'Email' },
                      { key: 'Skool Granted', label: 'Skool' },
                      { key: 'Kickoff Scheduled', label: 'Kickoff' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-5 lg:px-7 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary transition-colors"
                        onClick={() => handleStudentSort(key)}
                      >
                        <span className="flex items-center gap-1.5">
                          {label}
                          <SortButton column={key} sortState={studentSort} onSort={handleStudentSort} />
                        </span>
                      </th>
                    ))}
                    <th className="px-5 lg:px-7 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {paginatedStudents.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 lg:px-7 py-4 text-sm font-medium text-text-primary whitespace-nowrap max-w-[170px] truncate">
                        {record.fields['Full Name'] || '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
                          {record.fields['Program Tier Purchased'] || '--'}
                        </span>
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-sm text-text-secondary whitespace-nowrap">
                        {record.fields['Create Date']
                          ? new Date(record.fields['Create Date']).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-sm text-text-secondary whitespace-nowrap max-w-[200px] truncate">
                        {record.fields['Best Email'] || '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-center whitespace-nowrap">
                        {record.fields['Skool Granted'] ? (
                          <span className="text-emerald-400 text-base font-bold" title="Granted">
                            {'✓'}
                          </span>
                        ) : (
                          <span className="text-red-400 text-base font-bold" title="Not Granted">
                            {'✕'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 lg:px-7 py-4 text-sm text-text-secondary whitespace-nowrap">
                        {record.fields['Kickoff Scheduled']
                          ? new Date(record.fields['Kickoff Scheduled']).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '--'}
                      </td>
                      <td className="px-5 lg:px-7 py-4 whitespace-nowrap text-right">
                        <ActionButton
                          href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${record.id}`}
                          icon={ExternalLink}
                          label="Open Lead"
                          variant="ghost"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={studentPage}
              totalPages={studentTotalPages}
              totalItems={sortedStudents.length}
              pageSize={PAGE_SIZE}
              onPageChange={setStudentPage}
            />
          </>
        )}
      </SectionCard>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
