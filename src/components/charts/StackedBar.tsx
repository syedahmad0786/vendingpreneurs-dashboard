"use client";

import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

interface StackedKeyConfig {
  key: string;
  color: string;
  name?: string;
}

interface StackedBarProps {
  data: { name: string; [key: string]: unknown }[];
  title?: string;
  keys: StackedKeyConfig[];
  layout?: "vertical" | "horizontal";
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-xl"
      style={{
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <p
        style={{
          color: "#F1F5F9",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center gap-2"
          style={{ color: "#94A3B8" }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>
            {entry.name}: {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
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

export default function StackedBar({
  data,
  title,
  keys,
  layout = "horizontal",
}: StackedBarProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6">
        {title && (
          <h3 className="text-sm font-semibold text-text-secondary mb-4">
            {title}
          </h3>
        )}
        <div className="flex items-center justify-center h-64">
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
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            layout={layout === "vertical" ? "vertical" : "horizontal"}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            {layout === "vertical" ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
              </>
            )}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Legend content={renderLegend} verticalAlign="bottom" />
            {keys.map((k, index) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                name={k.name || k.key}
                stackId="stack"
                fill={k.color}
                radius={
                  index === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                }
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
                maxBarSize={48}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
