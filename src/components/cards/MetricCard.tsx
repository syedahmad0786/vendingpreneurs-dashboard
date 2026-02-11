"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

const COLOR_MAP: Record<string, { bg: string; text: string; glow: string }> = {
  blue: { bg: "bg-primary/15", text: "text-primary-light", glow: "glow-blue" },
  green: { bg: "bg-success/15", text: "text-success-light", glow: "glow-green" },
  amber: { bg: "bg-warning/15", text: "text-warning-light", glow: "glow-amber" },
  red: { bg: "bg-danger/15", text: "text-danger-light", glow: "glow-red" },
  purple: {
    bg: "bg-[#8B5CF6]/15",
    text: "text-[#A78BFA]",
    glow: "shadow-[0_0_15px_rgba(139,92,246,0.3),0_0_30px_rgba(139,92,246,0.1)]",
  },
};

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
  color?: "blue" | "green" | "amber" | "red" | "purple";
  loading?: boolean;
  prefix?: string;
  suffix?: string;
  /** Optional subtitle shown below value */
  subtitle?: string;
  /** Optional trend direction shown in badge */
  trend?: "up" | "down" | string;
  /** Optional trend label text */
  trendValue?: string;
}

function useCountUp(target: number, duration = 1500): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      // Use requestAnimationFrame to avoid synchronous setState in effect
      rafRef.current = requestAnimationFrame(() => setDisplay(0));
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }
    startRef.current = null;

    function step(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = "blue",
  loading = false,
  prefix,
  suffix,
  subtitle,
  trend,
  trendValue,
}: MetricCardProps) {
  const palette = COLOR_MAP[color] ?? COLOR_MAP.blue;
  const numericTarget =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const animatedValue = useCountUp(loading ? 0 : numericTarget);
  const formattedValue = animatedValue.toLocaleString();

  if (loading) {
    return (
      <div className="glass-card p-6 sm:p-7">
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-10 w-10 rounded-full" />
        </div>
        <div className="skeleton h-9 w-32 mb-3" />
        <div className="skeleton h-4 w-20" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}
      className={`glass-card p-6 sm:p-7 cursor-default transition-shadow duration-300 ${palette.glow}`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary leading-snug">
          {title}
        </h3>
        {Icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${palette.bg}`}>
            <Icon className={`w-5 h-5 ${palette.text}`} />
          </div>
        )}
      </div>

      <p className="text-3xl font-bold text-text-primary tracking-tight mb-1">
        {prefix && <span className="text-xl font-semibold mr-0.5">{prefix}</span>}
        {formattedValue}
        {suffix && <span className="text-xl font-semibold ml-0.5">{suffix}</span>}
      </p>

      {subtitle && (
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      )}

      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          {change >= 0 ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingDown className="w-4 h-4 text-danger" />
          )}
          <span className={`text-sm font-medium ${change >= 0 ? "text-success" : "text-danger"}`}>
            {change >= 0 ? "+" : ""}{change}%
          </span>
          {changeLabel && (
            <span className="text-xs text-text-muted ml-1">{changeLabel}</span>
          )}
        </div>
      )}

      {trend && !change && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend === "up" ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingDown className="w-4 h-4 text-danger" />
          )}
          {trendValue && (
            <span className={`text-xs font-medium ${trend === "up" ? "text-success" : "text-danger"}`}>
              {trendValue}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
