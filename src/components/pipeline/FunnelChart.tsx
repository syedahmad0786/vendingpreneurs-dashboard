"use client";

import { motion } from "framer-motion";
import type { StepId } from "@/lib/pipeline";

interface StepMeta { label: string; short: string; icon: React.ElementType; accent: string; }

export function FunnelChart({
  steps,
  byStep,
  total,
}: {
  steps: Array<{ id: StepId } & StepMeta>;
  byStep: Record<StepId, { success: number; error: number; pending: number }>;
  total: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="surface p-6 sm:p-7 flex flex-col gap-6"
    >
      <div>
        <h2 className="text-sm font-semibold text-text-primary tracking-tight">Onboarding funnel</h2>
        <p className="text-[11px] text-text-muted mt-1">
          Leads that successfully completed each step, out of {total} in pipeline.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const c = byStep[s.id] ?? { success: 0, error: 0, pending: 0 };
          const pct = total ? (c.success / total) * 100 : 0;
          const errPct = total ? (c.error / total) * 100 : 0;
          const Icon = s.icon;
          return (
            <div key={s.id} className="relative">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="font-mono text-text-whisper">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
                  <span className="font-medium text-text-primary">{s.label}</span>
                </span>
                <span className="flex items-center gap-3 tabular text-text-muted">
                  <span>
                    <span className="text-[#4EB65E] font-semibold">{c.success}</span>
                    <span className="text-text-whisper"> / {total}</span>
                  </span>
                  <span className="font-semibold tabular text-text-primary w-10 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="relative h-7 rounded-lg bg-white/[0.03] overflow-hidden border border-white/[0.05]">
                {/* success fill */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.05 * i }}
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(46,139,59,0.85), rgba(78,182,94,0.7))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                />
                {/* error fill (stacked after success) */}
                {c.error > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${errPct}%`, left: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.05 * i + 0.2 }}
                    className="absolute inset-y-0 rounded-r-lg"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, rgba(225,29,72,0.65), rgba(225,29,72,0.65) 6px, rgba(225,29,72,0.35) 6px, rgba(225,29,72,0.35) 12px)",
                    }}
                    title={`${c.error} errored`}
                  />
                )}
                {/* step label overlay when wide enough */}
                {pct > 18 && (
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-[#0F3B18]">
                    {s.short}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[#4EB65E]" /> success
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[#E11D48]" /> error
                </span>
                <span className="ml-auto">pending: {c.pending}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
