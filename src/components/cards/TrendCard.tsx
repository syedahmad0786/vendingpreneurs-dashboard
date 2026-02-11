"use client";

import React from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TrendDatum {
  name: string;
  value: number;
}

interface TrendCardProps {
  title: string;
  value: string | number;
  data: TrendDatum[];
  color?: string;
  change?: number;
}

export default function TrendCard({
  title,
  value,
  data,
  color = "#3B82F6",
  change,
}: TrendCardProps) {
  const gradientId = React.useId().replace(/:/g, "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}
      className="glass-card p-6 cursor-default"
    >
      <h3 className="text-sm font-medium text-text-secondary mb-1">{title}</h3>

      <div className="flex items-end justify-between mb-3">
        <p className="text-2xl font-bold text-text-primary tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        {change !== undefined && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              change >= 0
                ? "bg-success/15 text-success-light"
                : "bg-danger/15 text-danger-light"
            }`}
          >
            {change >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>

      <div className="w-full h-[60px] -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              animationDuration={800}
              animationEasing="ease-out"
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
