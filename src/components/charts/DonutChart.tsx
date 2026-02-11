"use client";

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

const DEFAULT_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DonutDatum }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-xl"
      style={{
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <p style={{ color: "#F1F5F9", fontWeight: 600 }}>{item.name}</p>
      <p style={{ color: "#94A3B8" }}>{item.value.toLocaleString()}</p>
    </div>
  );
}

interface LegendPayloadItem {
  value: string;
  color?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderLegend(props: any) {
  const { payload } = props;
  if (!payload) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ color: "#94A3B8" }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DonutChart({
  data,
  title,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data]
  );

  const displayValue = centerValue !== undefined ? centerValue : total;
  const displayLabel = centerLabel !== undefined ? centerLabel : "Total";

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] as const }}
      className="glass-card p-6"
    >
      {title && (
        <h3 className="text-sm font-semibold text-text-secondary mb-4">
          {title}
        </h3>
      )}

      <div className="relative w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.color ||
                    DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                  }
                  className="transition-opacity duration-200 hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold" style={{ color: "#F1F5F9" }}>
            {typeof displayValue === "number"
              ? displayValue.toLocaleString()
              : displayValue}
          </span>
          <span className="text-xs" style={{ color: "#64748B" }}>
            {displayLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
