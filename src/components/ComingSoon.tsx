"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle?: string;
  description?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-3xl mx-auto surface relative overflow-hidden px-8 py-14 text-center"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#2E8B3B]/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#F4C71A]/12 blur-3xl" />

      <div className="relative flex flex-col items-center gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1F6E2C] to-[#F4C71A] shadow-lg shadow-[#1F6E2C]/30 ring-1 ring-[#F4C71A]/25">
          <Sparkles className="w-7 h-7 text-white" />
        </div>

        <div className="space-y-2 max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#F4C71A] font-semibold">
            Coming soon
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="text-base text-text-secondary font-medium leading-relaxed">{subtitle}</p>
          )}
          {description && (
            <p className="text-sm text-text-muted leading-relaxed pt-1">{description}</p>
          )}
        </div>

        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F4C71A]/10 text-[#FFD94D] border border-[#F4C71A]/30 hover:bg-[#F4C71A]/20 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to onboarding pipeline
        </Link>
      </div>
    </motion.div>
  );
}
