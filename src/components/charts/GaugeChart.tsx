"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  title?: string;
  color?: string;
  suffix?: string;
}

function getAutoColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio < 0.33) return "#10B981";
  if (ratio < 0.66) return "#F59E0B";
  return "#EF4444";
}

export default function GaugeChart({
  value,
  max,
  label,
  title,
  color,
  suffix = "",
}: GaugeChartProps) {
  const fillColor = color || getAutoColor(value, max);
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percentage = max > 0 ? clampedValue / max : 0;

  // SVG arc calculations for a semi-circle
  const svgWidth = 200;
  const svgHeight = 130;
  const strokeWidth = 16;
  const cx = svgWidth / 2;
  const cy = 100;
  const radius = 75;

  // Arc endpoints: 180deg (left) to 0deg (right)
  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;
  const endY = cy;

  const bgArcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  // Calculate filled arc endpoint
  const filledArcPath = useMemo(() => {
    if (percentage <= 0) return "";
    const angle = Math.PI * (1 - percentage);
    const arcEndX = cx + radius * Math.cos(angle);
    const arcEndY = cy - radius * Math.sin(angle);
    const largeArc = percentage > 0.5 ? 1 : 0;
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${arcEndX} ${arcEndY}`;
  }, [percentage, cx, cy, radius, startX, startY]);

  // Total arc length for dash animation
  const totalArcLength = Math.PI * radius;

  if (max <= 0) {
    return (
      <div className="glass-card p-6">
        {title && (
          <h3 className="text-sm font-semibold text-text-secondary mb-4">
            {title}
          </h3>
        )}
        <div className="flex items-center justify-center h-48">
          <p className="text-text-muted text-sm">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-card p-6"
    >
      {title && (
        <h3 className="text-sm font-semibold text-text-secondary mb-4">
          {title}
        </h3>
      )}

      <div className="flex justify-center">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={bgArcPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Filled arc with animation */}
          {percentage > 0 && (
            <motion.path
              d={filledArcPath}
              fill="none"
              stroke={fillColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{
                strokeDasharray: totalArcLength,
                strokeDashoffset: totalArcLength,
              }}
              animate={{
                strokeDashoffset: totalArcLength * (1 - percentage),
              }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              style={{
                filter: `drop-shadow(0 0 8px ${fillColor}50)`,
              }}
            />
          )}

          {/* Center value text */}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#F1F5F9"
            fontSize="30"
            fontWeight="700"
            fontFamily="Inter, sans-serif"
          >
            {clampedValue.toLocaleString()}
            {suffix && (
              <tspan fontSize="14" fill="#64748B">
                {suffix}
              </tspan>
            )}
          </text>

          {/* Min label */}
          <text
            x={startX}
            y={cy + 20}
            textAnchor="middle"
            fill="#64748B"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            0
          </text>

          {/* Max label */}
          <text
            x={endX}
            y={cy + 20}
            textAnchor="middle"
            fill="#64748B"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            {max.toLocaleString()}
          </text>
        </svg>
      </div>

      {/* Label below gauge */}
      <p className="text-center text-sm font-medium text-text-secondary mt-2">
        {label}
      </p>
      <p className="text-center text-xs text-text-muted">
        {clampedValue.toLocaleString()} of {max.toLocaleString()} ({(percentage * 100).toFixed(0)}%)
      </p>
    </motion.div>
  );
}
