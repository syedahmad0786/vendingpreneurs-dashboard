"use client";

import { motion } from "framer-motion";
import { ExternalLink, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import type { LeadPipeline, StepId } from "@/lib/pipeline";
import { StepStatusIcon, OverallPill, statusBadgeClasses } from "./StepBadge";
import { ProgressRing } from "./ProgressRing";
import { truncate } from "@/lib/format";

interface StepMeta {
  label: string;
  short: string;
  icon: React.ElementType;
  accent: string;
  describe: string;
}

function initialsFor(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function avatarColor(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palette = [
    { bg: "linear-gradient(135deg,#1F6E2C,#4EB65E)", fg: "#F3F8F4" },
    { bg: "linear-gradient(135deg,#BC9A0A,#F4C71A)", fg: "#0F3B18" },
    { bg: "linear-gradient(135deg,#0F3B18,#2E8B3B)", fg: "#FFD94D" },
    { bg: "linear-gradient(135deg,#2E8B3B,#F4C71A)", fg: "#07110B" },
    { bg: "linear-gradient(135deg,#134019,#1F6E2C)", fg: "#F4C71A" },
  ];
  return palette[h % palette.length];
}

export function LeadCard({
  lead,
  stepMeta,
  onResubmit,
  resubmittingKey,
  onOpen,
  index = 0,
}: {
  lead: LeadPipeline;
  stepMeta: Record<StepId, StepMeta>;
  onResubmit: (lead: LeadPipeline, stepId: StepId) => void;
  resubmittingKey: string | null;
  onOpen: (lead: LeadPipeline) => void;
  index?: number;
}) {
  const completed = lead.steps.filter((s) => s.status === "success").length;
  const total = lead.steps.length;
  const hasErrors = lead.steps.some((s) => s.status === "error");
  const seed = (lead.email || lead.fullName || lead.id).toLowerCase();
  const av = avatarColor(seed);
  const initials = initialsFor(lead.fullName);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
      onClick={() => onOpen(lead)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(lead); }}
      className={`group relative surface px-5 sm:px-6 py-5 flex flex-col gap-4 cursor-pointer
        transition-all duration-200 hover:border-[#F4C71A]/30 hover:shadow-2xl hover:-translate-y-0.5
        ${hasErrors ? "ring-1 ring-[#E11D48]/25" : ""}
      `}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-5 bottom-5 w-1 rounded-r-full opacity-85"
        style={{
          background: hasErrors
            ? "linear-gradient(180deg,#E11D48,#FB7185)"
            : completed === total
            ? "linear-gradient(180deg,#2E8B3B,#4EB65E)"
            : "linear-gradient(180deg,#F4C71A,#FFD94D)",
        }}
      />

      <div className="flex items-center gap-4">
        <div
          className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl font-bold text-sm tracking-wider shadow-inner"
          style={{ background: av.bg, color: av.fg }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">
              {lead.fullName || "Unnamed lead"}
            </p>
            <OverallPill status={lead.overallStatus} />
          </div>
          <p className="text-xs text-text-muted truncate mt-1">
            <span className="text-text-secondary">{lead.email || "—"}</span>
            {lead.programTier && <span className="ml-2 text-[#F4C71A]/80">· {lead.programTier}</span>}
            {lead.salesRep && <span className="ml-2 opacity-70">· {lead.salesRep}</span>}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <ProgressRing value={completed} total={total} size={44} />
          <a
            href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${lead.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-white/[0.03] text-text-secondary border border-white/[0.07] hover:bg-white/[0.08] transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Airtable
          </a>
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] text-text-muted group-hover:text-[#F4C71A] group-hover:bg-[#F4C71A]/10 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Step strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {lead.steps.map((s) => {
          const m = stepMeta[s.id];
          const Icon = m.icon;
          const retryKey = `${lead.id}:${s.id}`;
          const retrying = resubmittingKey === retryKey;
          return (
            <div
              key={s.id}
              className={`pipeline-step pipeline-step-${s.status} relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition-all duration-150
                ${s.status === "error" ? "bg-[#E11D48]/10" :
                  s.status === "success" ? "bg-[#2E8B3B]/8" :
                  "bg-white/[0.02]"}
              `}
              title={`${m.label}: ${s.status}${s.errorMessage ? " — " + s.errorMessage : ""}`}
            >
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${statusBadgeClasses(s.status)}`}
              >
                <Icon className="w-3.5 h-3.5 opacity-80" />
              </div>
              <div className="flex items-center gap-1">
                <StepStatusIcon status={s.status} size={10} />
                <span
                  className="text-[10px] font-semibold leading-none"
                  style={{ color: s.status === "success" ? "#4EB65E" : s.status === "error" ? "#FB7185" : "#B4C6B8" }}
                >
                  {m.short}
                </span>
              </div>

              {s.status === "error" && s.id !== "vendhub" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onResubmit(lead, s.id); }}
                  disabled={retrying}
                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold text-[#0F3B18] bg-[#F4C71A] hover:bg-[#FFD94D] rounded-md disabled:opacity-50 transition-colors"
                >
                  {retrying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                  Retry
                </button>
              )}

              {s.status === "success" && s.detail && (
                <span
                  className="text-[9px] text-text-muted leading-tight text-center max-w-full"
                  title={s.detail}
                >
                  {truncate(s.detail, 32)}
                </span>
              )}
              {s.status === "error" && s.errorMessage && (
                <span
                  className="text-[9px] text-[#FB7185]/90 leading-tight text-center max-w-full"
                  title={s.error?.raw || s.errorMessage}
                >
                  {truncate(s.errorMessage, 32)}
                </span>
              )}
              {s.status === "pending" && s.detail && (
                <span
                  className="text-[9px] text-text-whisper leading-tight text-center max-w-full"
                  title={s.detail}
                >
                  {truncate(s.detail, 32)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}
