"use client";

import { CheckCircle2, XCircle, Clock, Loader2, CircleDashed } from "lucide-react";
import type { StepStatus } from "@/lib/pipeline";

export function StepStatusIcon({ status, size = 16 }: { status: StepStatus; size?: number }) {
  const common = { size, strokeWidth: 2.4 };
  switch (status) {
    case "success":
      return <CheckCircle2 {...common} className="text-[#4EB65E]" />;
    case "error":
      return <XCircle {...common} className="text-[#FB7185]" />;
    case "in_progress":
      return <Loader2 {...common} className="text-[#F4C71A] animate-spin" />;
    case "pending":
      return <Clock {...common} className="text-[#B4C6B8]/70" />;
    default:
      return <CircleDashed {...common} className="text-text-muted" />;
  }
}

export function statusBadgeClasses(status: StepStatus): string {
  switch (status) {
    case "success":
      return "bg-[#2E8B3B]/12 text-[#4EB65E] border-[#2E8B3B]/25";
    case "error":
      return "bg-[#E11D48]/12 text-[#FB7185] border-[#E11D48]/30";
    case "in_progress":
      return "bg-[#F4C71A]/12 text-[#FFD94D] border-[#F4C71A]/30";
    case "pending":
      return "bg-white/[0.04] text-[#B4C6B8] border-white/[0.08]";
    default:
      return "bg-white/[0.03] text-text-muted border-white/[0.06]";
  }
}

export function OverallPill({ status }: { status: StepStatus }) {
  const label =
    status === "success"
      ? "Complete"
      : status === "error"
        ? "Blocked"
        : status === "in_progress"
          ? "In Progress"
          : status === "pending"
            ? "Queued"
            : "Unknown";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusBadgeClasses(status)}`}
    >
      <StepStatusIcon status={status} size={12} />
      {label}
    </span>
  );
}
