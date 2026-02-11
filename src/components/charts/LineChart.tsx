"use client";

import React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";

interface DataKeyConfig {
  key: string;
  color: string;
  name?: string;
}

interface LineChartProps {
  data: { name: string; [key: string]: unknown }[];
  title?: string;
  dataKeys: DataKeyConfig[];
  areaFill?: boolean;
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
      <p style={{ color: "#F1F5F9", fontWeight: 600, marginBottom: 4 }}>
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

export default function LineChartComponent({
  data,
  title,
  dataKeys,
  areaFill = false,
}: LineChartProps) {
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
          {areaFill ? (
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <defs>
                {dataKeys.map((dk) => (
                  <linearGradient
                    key={dk.key}
                    id={`areaGrad-${dk.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={dk.color}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={dk.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
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
              <Tooltip content={<CustomTooltip />} />
              {dataKeys.length > 1 && (
                <Legend content={renderLegend} verticalAlign="bottom" />
              )}
              {dataKeys.map((dk) => (
                <Area
                  key={dk.key}
                  type="monotone"
                  dataKey={dk.key}
                  name={dk.name || dk.key}
                  stroke={dk.color}
                  strokeWidth={2.5}
                  fill={`url(#areaGrad-${dk.key})`}
                  animationBegin={0}
                  animationDuration={1000}
                  animationEasing="ease-out"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: dk.color,
                    stroke: "#0A0F1E",
                    strokeWidth: 2,
                  }}
                />
              ))}
            </AreaChart>
          ) : (
            <RechartsLineChart
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
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
              <Tooltip content={<CustomTooltip />} />
              {dataKeys.length > 1 && (
                <Legend content={renderLegend} verticalAlign="bottom" />
              )}
              {dataKeys.map((dk) => (
                <Line
                  key={dk.key}
                  type="monotone"
                  dataKey={dk.key}
                  name={dk.name || dk.key}
                  stroke={dk.color}
                  strokeWidth={2.5}
                  animationBegin={0}
                  animationDuration={1000}
                  animationEasing="ease-out"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: dk.color,
                    stroke: "#0A0F1E",
                    strokeWidth: 2,
                  }}
                />
              ))}
            </RechartsLineChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
