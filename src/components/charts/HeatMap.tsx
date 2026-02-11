"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface HeatMapDatum {
  row: string;
  col: string;
  value: number;
}

interface HeatMapProps {
  data: HeatMapDatum[];
  title?: string;
  rowLabels?: string[];
  colLabels?: string[];
}

function interpolateColor(value: number, min: number, max: number): string {
  if (max === min) return "rgba(59, 130, 246, 0.3)";
  const ratio = (value - min) / (max - min);
  // From dim blue to bright blue
  const opacity = 0.08 + ratio * 0.82;
  return `rgba(59, 130, 246, ${opacity.toFixed(2)})`;
}

export default function HeatMap({
  data,
  title,
  rowLabels: propRowLabels,
  colLabels: propColLabels,
}: HeatMapProps) {
  const [tooltip, setTooltip] = useState<{
    row: string;
    col: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  // Derive labels from data if not provided
  const rowLabels = useMemo(() => {
    if (propRowLabels) return propRowLabels;
    const seen = new Set<string>();
    return data
      .map((d) => d.row)
      .filter((r) => {
        if (seen.has(r)) return false;
        seen.add(r);
        return true;
      });
  }, [data, propRowLabels]);

  const colLabels = useMemo(() => {
    if (propColLabels) return propColLabels;
    const seen = new Set<string>();
    return data
      .map((d) => d.col)
      .filter((c) => {
        if (seen.has(c)) return false;
        seen.add(c);
        return true;
      });
  }, [data, propColLabels]);

  // Build a lookup map
  const valueMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((d) => map.set(`${d.row}__${d.col}`, d.value));
    return map;
  }, [data]);

  // Min/max for color scaling
  const { min, max } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0 };
    const values = data.map((d) => d.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data]);

  if (!data || data.length === 0) {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-card p-6"
    >
      {title && (
        <h3 className="text-sm font-semibold text-text-secondary mb-4">
          {title}
        </h3>
      )}

      <div className="relative overflow-x-auto">
        {/* Column headers */}
        <div
          className="grid gap-1 mb-1"
          style={{
            gridTemplateColumns: `80px repeat(${colLabels.length}, 1fr)`,
          }}
        >
          <div /> {/* empty corner cell */}
          {colLabels.map((col) => (
            <div
              key={col}
              className="text-[11px] text-center truncate px-1"
              style={{ color: "#64748B" }}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {rowLabels.map((row, rowIndex) => (
          <div
            key={row}
            className="grid gap-1 mb-1"
            style={{
              gridTemplateColumns: `80px repeat(${colLabels.length}, 1fr)`,
            }}
          >
            {/* Row label */}
            <div
              className="text-[11px] flex items-center truncate pr-2"
              style={{ color: "#64748B" }}
            >
              {row}
            </div>

            {/* Cells */}
            {colLabels.map((col, colIndex) => {
              const cellValue = valueMap.get(`${row}__${col}`) ?? 0;
              const bgColor = interpolateColor(cellValue, min, max);
              const flatIndex = rowIndex * colLabels.length + colIndex;

              return (
                <motion.div
                  key={`${row}-${col}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: flatIndex * 0.015,
                    duration: 0.3,
                    ease: "easeOut",
                  }}
                  className="relative rounded cursor-pointer transition-transform duration-150 hover:scale-110 hover:z-10"
                  style={{
                    backgroundColor: bgColor,
                    aspectRatio: "1",
                    minHeight: 28,
                  }}
                  onMouseEnter={(e) => {
                    const rect = (
                      e.target as HTMLElement
                    ).getBoundingClientRect();
                    setTooltip({
                      row,
                      col,
                      value: cellValue,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 rounded-xl px-4 py-3 text-sm shadow-xl pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 60,
              transform: "translateX(-50%)",
              background: "rgba(15, 23, 42, 0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <p style={{ color: "#F1F5F9", fontWeight: 600 }}>
              {tooltip.row} / {tooltip.col}
            </p>
            <p style={{ color: "#94A3B8" }}>
              {tooltip.value.toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
