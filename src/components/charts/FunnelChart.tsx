"use client";

import React from "react";
import { motion } from "framer-motion";

const DEFAULT_COLORS = [
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#C084FC",
  "#D8B4FE",
  "#EC4899",
  "#F59E0B",
];

interface FunnelDatum {
  name: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  data: FunnelDatum[];
  title?: string;
}

export default function FunnelChart({ data, title }: FunnelChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6">
        {title && (
          <h3 className="text-sm font-semibold text-text-secondary mb-4">
            {title}
          </h3>
        )}
        <div className="flex items-center justify-center h-56">
          <p className="text-text-muted text-sm">No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = data[0].value || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-card p-6"
    >
      {title && (
        <h3 className="text-sm font-semibold text-text-secondary mb-6">
          {title}
        </h3>
      )}

      <div className="space-y-2">
        {data.map((stage, index) => {
          const widthPercent = Math.max(
            (stage.value / maxValue) * 100,
            15
          );
          const barColor =
            stage.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          const prevValue = index > 0 ? data[index - 1].value : null;
          const conversionRate =
            prevValue && prevValue > 0
              ? ((stage.value / prevValue) * 100).toFixed(1)
              : null;

          return (
            <div key={stage.name}>
              {/* Conversion rate between stages */}
              {conversionRate && (
                <div className="flex justify-center my-1">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      color: "#64748B",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    {conversionRate}% conversion
                  </span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.5,
                  ease: "easeOut",
                }}
                style={{ originX: 0 }}
                className="flex items-center gap-3"
              >
                {/* Background track */}
                <div
                  className="relative h-10 w-full rounded-lg overflow-hidden"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                >
                  {/* Colored fill bar */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end px-3 transition-all duration-500"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: barColor,
                      opacity: 1 - index * 0.06,
                    }}
                  >
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {stage.value.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Label */}
                <span
                  className="text-sm whitespace-nowrap min-w-[80px]"
                  style={{ color: "#94A3B8" }}
                >
                  {stage.name}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
