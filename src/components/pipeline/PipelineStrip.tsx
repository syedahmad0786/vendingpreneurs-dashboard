"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import type { StepId } from "@/lib/pipeline";

type ByStep = Record<StepId, { success: number; error: number; pending: number }>;

interface Meta {
  label: string;
  short: string;
  icon: React.ElementType;
  accent: string;
  describe: string;
}

export function PipelineStrip({
  steps,
  byStep,
  total,
  activeStep,
  onStepClick,
}: {
  steps: Array<{ id: StepId } & Meta>;
  byStep: ByStep;
  total: number;
  activeStep?: StepId | "all";
  onStepClick?: (id: StepId | "all") => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 }}
      className="surface relative overflow-hidden"
    >
      <div className="flex items-center justify-between px-7 pt-6">
        <div>
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">Step health</h2>
          <p className="text-[11px] text-text-muted mt-1">Click a step to filter leads currently blocked there.</p>
        </div>
      </div>

      <div className="px-5 sm:px-7 pb-7 pt-5 relative">
        <div className="stepper-rail grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-0 relative z-10">
          {steps.map((s, i) => {
            const counts = byStep[s.id] ?? { success: 0, error: 0, pending: 0 };
            const health =
              counts.error > 0 ? "error"
              : counts.pending === 0 ? "success"
              : "partial";
            const active = activeStep === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => onStepClick?.(active ? "all" : s.id)}
                className={`group relative flex flex-col items-center text-center px-3 py-3 rounded-xl transition-all duration-200
                  ${active ? "bg-[#F4C71A]/10 ring-1 ring-[#F4C71A]/35" : "hover:bg-white/[0.035]"}
                `}
                aria-pressed={active}
                title={`${s.label} — ${counts.success} ok, ${counts.error} blocked, ${counts.pending} pending`}
              >
                {/* Step index badge */}
                <div className="absolute -top-2 -left-1 text-[9px] font-semibold text-text-whisper tabular">
                  {String(i + 1).padStart(2, "0")}
                </div>

                {/* Icon dial */}
                <div
                  className={`flex items-center justify-center w-14 h-14 rounded-full relative shrink-0 transition-all duration-200
                    ${health === "error" ? "bg-[#E11D48]/10 ring-1 ring-[#E11D48]/40" :
                       health === "success" ? "bg-[#2E8B3B]/15 ring-1 ring-[#2E8B3B]/45" :
                       "bg-[#F4C71A]/10 ring-1 ring-[#F4C71A]/30"}
                    group-hover:scale-105
                  `}
                  style={{ boxShadow: `0 0 0 3px rgba(7,17,11,1)` }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{
                      color: health === "error" ? "#FB7185" : health === "success" ? "#4EB65E" : s.accent,
                    }}
                  />
                  {health === "error" && counts.error > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center animate-pulse-ring">
                      {counts.error}
                    </span>
                  )}
                </div>

                {/* Step label */}
                <div className="mt-3 flex flex-col items-center gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                    Step {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-text-primary leading-tight">
                    {s.label}
                  </span>
                </div>

                {/* Count strip */}
                <div className="mt-2 flex items-center gap-2.5 text-[11px]">
                  <span className="flex items-center gap-1 text-[#4EB65E]">
                    <CheckCircle2 className="w-3 h-3" /> {counts.success}
                  </span>
                  <span className="flex items-center gap-1 text-[#FB7185]">
                    <XCircle className="w-3 h-3" /> {counts.error}
                  </span>
                  <span className="flex items-center gap-1 text-[#B4C6B8]">
                    <Clock className="w-3 h-3" /> {counts.pending}
                  </span>
                </div>

                {/* Success fill bar */}
                <div className="mt-2 w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${total ? (counts.success / total) * 100 : 0}%`,
                      background:
                        health === "error"
                          ? "linear-gradient(90deg,#4EB65E,#F4C71A)"
                          : health === "success"
                          ? "linear-gradient(90deg,#2E8B3B,#4EB65E)"
                          : "linear-gradient(90deg,#F4C71A,#FFD94D)",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
