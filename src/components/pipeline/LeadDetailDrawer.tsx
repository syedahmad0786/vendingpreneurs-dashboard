"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Calendar,
  Mail,
  Building2,
  UserCircle2,
  Hash,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LeadPipeline, StepId, StepState } from "@/lib/pipeline";
import { StepStatusIcon, OverallPill, statusBadgeClasses } from "./StepBadge";
import { ProgressRing } from "./ProgressRing";
import { truncate, timeAgo } from "@/lib/format";

interface StepMeta {
  label: string;
  short: string;
  icon: React.ElementType;
  accent: string;
  describe: string;
}

export function LeadDetailDrawer({
  lead,
  stepMeta,
  onClose,
  onResubmit,
  resubmittingKey,
}: {
  lead: LeadPipeline | null;
  stepMeta: Record<StepId, StepMeta>;
  onClose: () => void;
  onResubmit: (lead: LeadPipeline, stepId: StepId) => void;
  resubmittingKey: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lead, onClose]);

  async function copy(label: string, value?: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  const completed = lead ? lead.steps.filter((s) => s.status === "success").length : 0;
  const total = lead?.steps.length ?? 5;

  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            // z-65 — above everything on the page including the sticky nav (z-60).
            className="fixed inset-0 z-[65] backdrop-shade"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            // z-70 — sits above the sticky nav so it covers the full viewport on the right.
            className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[520px] lg:w-[620px] overflow-y-auto border-l border-[#F4C71A]/15 shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Lead detail: ${lead.fullName}`}
            style={{
              // Fully opaque background so sticky nav from the parent document cannot bleed through.
              backgroundColor: "#0B1A10",
              backgroundImage: "linear-gradient(180deg, rgba(28,54,37,0.35) 0%, rgba(11,26,16,0) 40%)",
            }}
          >
            {/* Own opaque top bar — full width, extends above the sticky nav */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#F4C71A]/10"
              style={{ backgroundColor: "#0B1A10" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProgressRing value={completed} total={total} size={48} stroke={4.5} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{lead.fullName || "Unnamed lead"}</p>
                  <p className="text-xs text-text-muted truncate">{lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <OverallPill status={lead.overallStatus} />
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-lg bg-white/[0.04] text-text-muted hover:bg-white/[0.08] hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                  <kbd className="hidden sm:inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-mono font-semibold rounded border border-white/10 text-text-muted bg-white/[0.04]">
                    Esc
                  </kbd>
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Meta grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetaRow icon={Mail} label="Email" value={lead.email} onCopy={() => copy("email", lead.email)} copied={copied === "email"} />
                <MetaRow icon={UserCircle2} label="Sales rep" value={lead.salesRep} />
                <MetaRow icon={Building2} label="Program tier" value={lead.programTier} />
                <MetaRow
                  icon={Calendar}
                  label="Created"
                  value={lead.createdAt ? `${timeAgo(lead.createdAt)} · ${new Date(lead.createdAt).toLocaleDateString()}` : undefined}
                />
                {lead.clientId && (
                  <MetaRow
                    icon={Hash}
                    label="Close lead ID"
                    value={lead.clientId}
                    mono
                    onCopy={() => copy("cid", lead.clientId)}
                    copied={copied === "cid"}
                    wide
                  />
                )}
              </div>

              {/* Step timeline */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-text-muted">
                    Onboarding steps
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    {completed} / {total} complete
                  </span>
                </div>
                <ol className="flex flex-col gap-2 relative">
                  <div className="absolute left-[22px] top-2 bottom-2 w-px bg-gradient-to-b from-[#2E8B3B]/50 via-white/5 to-[#F4C71A]/40" />
                  {lead.steps.map((s, i) => {
                    const m = stepMeta[s.id];
                    const retryKey = `${lead.id}:${s.id}`;
                    const retrying = resubmittingKey === retryKey;
                    return (
                      <StepLi
                        key={s.id}
                        s={s}
                        i={i}
                        icon={m.icon}
                        label={m.label}
                        describe={m.describe}
                        retrying={retrying}
                        canRetry={s.status === "error" && s.id !== "vendhub"}
                        onRetry={() => onResubmit(lead, s.id)}
                      />
                    );
                  })}
                </ol>
              </section>

              {/* Links */}
              <section className="flex flex-wrap gap-2">
                <a
                  href={`https://airtable.com/appgqED05AlPLi0ar/tblMLFYTeoqrtmgXQ/${lead.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] text-text-secondary border border-white/[0.07] hover:bg-white/[0.08] transition-colors text-xs font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Airtable
                </a>
                {lead.clientId && (
                  <a
                    href={`https://app.close.com/lead/${lead.clientId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] text-text-secondary border border-white/[0.07] hover:bg-white/[0.08] transition-colors text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Close CRM
                  </a>
                )}
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Renders a single onboarding-step list item with the full error breakdown
 * (message, type, node, execution id, timestamp, raw payload) when status = error.
 */
function StepLi({
  s,
  i,
  icon: Icon,
  label,
  describe,
  retrying,
  canRetry,
  onRetry,
}: {
  s: StepState;
  i: number;
  icon: React.ElementType;
  label: string;
  describe: string;
  retrying: boolean;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const err = s.error;
  return (
    <li className="relative flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
      <div className={`relative z-10 flex items-center justify-center w-11 h-11 rounded-full shrink-0 border ${statusBadgeClasses(s.status)}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-text-whisper tracking-[0.18em]">
            STEP {i + 1}
          </span>
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          <span
            className={`chip ${
              s.status === "success" ? "chip-success"
              : s.status === "error" ? "chip-danger"
              : s.status === "in_progress" ? "chip-warning"
              : "chip-muted"
            }`}
          >
            <StepStatusIcon status={s.status} size={11} />
            {s.status === "in_progress" ? "in progress" : s.status}
          </span>
        </div>
        <p className="text-xs text-text-muted mt-1">{describe}</p>

        {s.detail && s.status !== "error" && (
          <p className="text-xs text-text-secondary mt-2">
            <span className="text-text-muted">Detail:</span>{" "}
            <span title={s.detail}>{truncate(s.detail, 80)}</span>
          </p>
        )}

        {/* Full error breakdown */}
        {s.status === "error" && (
          <div className="mt-2.5 rounded-lg border border-[#E11D48]/25 bg-[#E11D48]/[0.06] p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[#FB7185] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-[#FB7185] leading-snug break-words">
                  {s.errorMessage}
                </p>
                {err?.humanized && (
                  <p className="text-[10px] text-text-muted mt-0.5 italic">
                    Airtable did not record a raw error — this is a fallback description.
                  </p>
                )}

                {/* Structured metadata */}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  {err?.type && (
                    <>
                      <dt className="text-text-whisper uppercase tracking-[0.15em] text-[10px]">Type</dt>
                      <dd className="text-text-secondary">{err.type}</dd>
                    </>
                  )}
                  {err?.node && (
                    <>
                      <dt className="text-text-whisper uppercase tracking-[0.15em] text-[10px]">Node</dt>
                      <dd className="text-text-secondary font-mono break-all">{err.node}</dd>
                    </>
                  )}
                  {err?.executionId && (
                    <>
                      <dt className="text-text-whisper uppercase tracking-[0.15em] text-[10px]">Execution</dt>
                      <dd>
                        <a
                          href={`https://n8n.aimanagingservices.com/workflow/executions/${err.executionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FFD94D] font-mono hover:underline inline-flex items-center gap-1"
                        >
                          #{err.executionId}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </dd>
                    </>
                  )}
                  {err?.timestamp && (
                    <>
                      <dt className="text-text-whisper uppercase tracking-[0.15em] text-[10px]">Seen</dt>
                      <dd className="text-text-secondary">{timeAgo(err.timestamp)}</dd>
                    </>
                  )}
                </dl>

                {/* Raw payload expandable */}
                {err?.raw && (
                  <button
                    onClick={() => setRawOpen((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-[#F4C71A] transition-colors"
                  >
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${rawOpen ? "rotate-180" : ""}`}
                    />
                    {rawOpen ? "Hide" : "Show"} raw error payload
                  </button>
                )}
                {rawOpen && err?.raw && (
                  <pre className="mt-2 max-h-64 overflow-auto bg-black/40 border border-white/[0.05] rounded-md p-3 text-[10px] font-mono text-text-secondary whitespace-pre-wrap break-words">
                    {err.raw}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {canRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F4C71A] text-[#0F3B18] text-xs font-semibold hover:bg-[#FFD94D] disabled:opacity-50 transition-colors shadow-md shadow-[#F4C71A]/20"
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Retry this step
          </button>
        )}
      </div>
    </li>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
  onCopy,
  copied,
  wide,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  wide?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`surface-sunken p-3 flex items-start gap-3 ${wide ? "sm:col-span-2" : ""}`}>
      <Icon className="w-3.5 h-3.5 text-[#F4C71A] mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold">{label}</p>
        <p
          className={`mt-0.5 text-sm text-text-primary ${mono ? "font-mono text-[11px]" : ""} truncate`}
          title={value}
        >
          {value}
        </p>
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-[#F4C71A] hover:bg-white/[0.04] transition-colors"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
