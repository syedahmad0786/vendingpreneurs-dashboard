"use client";

import React from "react";
import { motion } from "framer-motion";
import { Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";

const SEVERITY_MAP = {
  info: {
    border: "border-l-primary",
    icon: Info,
    iconColor: "text-primary-light",
    bg: "bg-primary/5",
    badge: "bg-primary/15 text-primary-light",
    pulse: false,
  },
  warning: {
    border: "border-l-warning",
    icon: AlertTriangle,
    iconColor: "text-warning-light",
    bg: "bg-warning/5",
    badge: "bg-warning/15 text-warning-light",
    pulse: false,
  },
  error: {
    border: "border-l-danger",
    icon: XCircle,
    iconColor: "text-danger-light",
    bg: "bg-danger/5",
    badge: "bg-danger/15 text-danger-light",
    pulse: true,
  },
  success: {
    border: "border-l-success",
    icon: CheckCircle,
    iconColor: "text-success-light",
    bg: "bg-success/5",
    badge: "bg-success/15 text-success-light",
    pulse: false,
  },
} as const;

interface AlertCardProps {
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  timestamp?: string;
  action?: { label: string; onClick: () => void };
}

export default function AlertCard({
  title,
  message,
  severity,
  timestamp,
  action,
}: AlertCardProps) {
  const cfg = SEVERITY_MAP[severity];
  const SeverityIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`glass-card border-l-4 ${cfg.border} ${cfg.bg} px-4 py-3 flex items-start gap-3 ${cfg.pulse ? "animate-pulse-glow" : ""}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <SeverityIcon className={`w-5 h-5 ${cfg.iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-sm font-semibold text-text-primary truncate">
            {title}
          </h4>
          {timestamp && (
            <span className="text-[11px] text-text-muted flex-shrink-0">
              {timestamp}
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
          {message}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-200 ${cfg.badge} hover:opacity-80`}
          >
            {action.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}
