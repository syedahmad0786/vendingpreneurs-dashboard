"use client";

import { motion } from "framer-motion";
import { Activity, TrendingUp, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { BigProgressRing } from "./ProgressRing";
import { clockTime } from "@/lib/format";

interface Summary {
  total: number;
  completed: number;
  errored: number;
  inProgress: number;
}

interface TrendPoint {
  day: string;      // YYYY-MM-DD
  count: number;
}

export function OverviewHero({
  summary,
  todayCount,
  trend,
  updatedAt,
}: {
  summary: Summary | null;
  todayCount: number;
  trend: TrendPoint[];
  updatedAt?: string;
}) {
  const pct = summary && summary.total > 0
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  const weekTotal = trend.reduce((s, p) => s + p.count, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="surface relative overflow-hidden"
    >
      <div className="ribbon-gold absolute inset-x-0 top-0" />

      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#2E8B3B]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-32 h-64 w-64 rounded-full bg-[#F4C71A]/10 blur-3xl" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-10 px-8 py-8 lg:px-10 lg:py-10">
        {/* LEFT — headline + stats */}
        <div className="flex flex-col gap-7">
          <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#F4C71A] uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#4EB65E]" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4EB65E]" />
            </span>
            Live onboarding pipeline
            {updatedAt && (
              <span className="text-text-muted normal-case tracking-normal text-[11px] font-normal">
                · updated {clockTime(updatedAt)}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight tabular leading-none">
                <span className="gradient-text">{summary?.total ?? 0}</span>
              </h1>
              <span className="text-text-secondary text-sm font-medium">
                leads in pipeline
              </span>
            </div>
            <p className="text-text-muted text-sm mt-3 max-w-prose leading-relaxed">
              Every lead from Close CRM → VendHub, tracked in real time. Click any lead to see its full
              journey, error history, and per-step retry actions.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HeroStat icon={CheckCircle2} label="Completed" value={summary?.completed ?? 0} tint="#4EB65E" />
            <HeroStat icon={Clock} label="In progress" value={summary?.inProgress ?? 0} tint="#38BDF8" />
            <HeroStat icon={AlertCircle} label="Blocked" value={summary?.errored ?? 0} tint="#FB7185" />
            {todayCount > 0 ? (
              <HeroStat icon={TrendingUp} label="Added today" value={todayCount} tint="#F4C71A" />
            ) : (
              <TrendTile weekTotal={weekTotal} trend={trend} />
            )}
          </div>
        </div>

        {/* RIGHT — completion ring */}
        <div className="flex flex-col items-center lg:items-end justify-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
                Completion
              </span>
              <span className="text-xs text-text-secondary max-w-[180px]">
                {summary?.completed ?? 0} of {summary?.total ?? 0} leads fully onboarded
              </span>
              <div className="mt-3 text-[11px] text-text-muted flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#F4C71A]" /> Refreshes every 60 s
              </div>
            </div>
            <BigProgressRing
              value={summary?.completed ?? 0}
              total={summary?.total ?? 1}
              label={`${pct}% complete`}
              size={144}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="surface-sunken px-4 py-3 flex items-center gap-3 rounded-xl">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{ backgroundColor: `${tint}1a`, color: tint }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</span>
        <span className="text-xl font-bold tabular leading-tight mt-0.5" style={{ color: tint }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function TrendTile({ weekTotal, trend }: { weekTotal: number; trend: TrendPoint[] }) {
  const plus = weekTotal > 0 ? `+${weekTotal}` : "0";
  return (
    <div className="surface-sunken px-4 py-3 flex items-center gap-3 rounded-xl overflow-hidden">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-[#F4C71A]/12 text-[#F4C71A]">
        <TrendingUp className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">7-day trend</span>
        <span className="text-xl font-bold tabular leading-tight mt-0.5 text-[#F4C71A]">
          {plus} <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.18em]">this week</span>
        </span>
      </div>
      <div className="flex-1 min-w-0 h-8 -mr-1 ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
            <Tooltip
              contentStyle={{
                background: "rgba(9,19,13,0.95)",
                border: "1px solid rgba(244,199,26,0.22)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#F3F8F4" }}
              itemStyle={{ color: "#F4C71A" }}
              formatter={(v) => [typeof v === "number" ? v : 0, "new"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#F4C71A"
              strokeWidth={1.6}
              dot={false}
              activeDot={{ r: 3, fill: "#F4C71A" }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
