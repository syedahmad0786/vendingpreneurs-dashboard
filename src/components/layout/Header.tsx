"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/onboarding": "Onboarding Pipeline",
  "/clients": "Client Management",
  "/leads": "Lead Tracking",
  "/national": "National Accounts",
  "/revenue": "Revenue Analytics",
  "/quality": "Quality Assurance",
};

export default function Header() {
  const pathname = usePathname();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const title = routeTitles[pathname] || "Dashboard";

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor(
        (new Date().getTime() - lastUpdated.getTime()) / 60000
      );
      setMinutesAgo(diff);
    }, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setLastUpdated(new Date());
    setMinutesAgo(0);
    setTimeout(() => setRefreshing(false), 1500);
    window.dispatchEvent(new CustomEvent("dashboard-refresh"));
  }, []);

  return (
    <header className="sticky top-0 z-20 w-full">
      <div className="glass-strong px-6 py-4 flex items-center justify-between">
        <motion.h1
          key={pathname}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xl font-bold text-text-primary"
        >
          {title}
        </motion.h1>
        <div className="flex items-center gap-4">
          {/* Last updated indicator */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span>
              {minutesAgo === 0
                ? "Just updated"
                : `Updated ${minutesAgo}m ago`}
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              text-text-secondary hover:text-text-primary hover:bg-white/5
              transition-all duration-200 disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}