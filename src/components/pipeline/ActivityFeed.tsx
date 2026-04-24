"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Activity, ArrowRight } from "lucide-react";
import type { LeadPipeline } from "@/lib/pipeline";
import { timeAgo, truncate } from "@/lib/format";

export function ActivityFeed({
  leads,
  onOpen,
  limit = 8,
}: {
  leads: LeadPipeline[];
  onOpen: (lead: LeadPipeline) => void;
  limit?: number;
}) {
  // De-dupe by lead id (Airtable occasionally surfaces duplicate rows for the same person)
  const seen = new Set<string>();
  const deduped = leads.filter((l) => {
    const key = l.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Blocked first, then most recent
  const sorted = [...deduped].sort((a, b) => {
    const aErr = a.steps.some((s) => s.status === "error") ? 1 : 0;
    const bErr = b.steps.some((s) => s.status === "error") ? 1 : 0;
    if (aErr !== bErr) return bErr - aErr;
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return bd - ad;
  });

  const items = sorted.slice(0, limit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="surface p-6 sm:p-7 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 tracking-tight">
            <Activity className="w-3.5 h-3.5 text-[#F4C71A]" /> Needs attention
          </h2>
          <p className="text-[11px] text-text-muted mt-1">
            Blocked leads first, then most recently added.
          </p>
        </div>
      </div>
      <ol className="flex flex-col gap-1">
        {items.length === 0 ? (
          <div className="text-xs text-text-muted py-10 text-center border border-dashed border-white/5 rounded-lg">
            Nothing urgent — all green.
          </div>
        ) : (
          items.map((l) => {
            const err = l.steps.find((s) => s.status === "error");
            const hasErr = Boolean(err);
            const complete = l.steps.filter((s) => s.status === "success").length;
            return (
              <li
                key={l.id}
                onClick={() => onOpen(l)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onOpen(l); }}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 border ${
                    hasErr
                      ? "bg-[#E11D48]/10 text-[#FB7185] border-[#E11D48]/30"
                      : complete === l.steps.length
                      ? "bg-[#2E8B3B]/12 text-[#4EB65E] border-[#2E8B3B]/30"
                      : "bg-[#F4C71A]/10 text-[#FFD94D] border-[#F4C71A]/30"
                  }`}
                >
                  {hasErr ? <XCircle className="w-4 h-4" /> : complete === l.steps.length ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary font-medium truncate leading-snug">
                    {l.fullName || l.email || "Unknown"}
                  </p>
                  <p className="text-[11px] text-text-muted truncate leading-relaxed mt-0.5">
                    {hasErr ? (
                      <>
                        Blocked on <span className="text-[#FB7185]">{err?.label}</span>
                        {err?.errorMessage ? (
                          <>
                            {" · "}
                            <span
                              title={err.error?.raw || err.errorMessage}
                              className={err.error?.humanized ? "" : "text-[#FB7185]/85"}
                            >
                              {truncate(err.errorMessage, 60)}
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : complete === l.steps.length ? (
                      "Onboarding complete"
                    ) : (
                      `${complete}/${l.steps.length} steps complete`
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-text-whisper tabular">{timeAgo(l.createdAt)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-whisper group-hover:text-[#F4C71A] transition-colors" />
                </div>
              </li>
            );
          })
        )}
      </ol>
    </motion.div>
  );
}
