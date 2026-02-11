"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Module-level cache — survives across SPA navigations (client-side only)
// ---------------------------------------------------------------------------
let cachedStats: Record<string, unknown> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function isCacheValid(): boolean {
  return cachedStats !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(cachedStats);
  const [loading, setLoading] = useState(!isCacheValid());
  const fetchingRef = useRef(false);

  const fetchStats = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setLoading(true);
    try {
      const url = forceRefresh ? "/api/stats?refresh=true" : "/api/stats";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        cachedStats = data;
        cacheTimestamp = Date.now();
        setStats(data);
      }
    } catch (err) {
      console.error("[useStats] Fetch failed:", err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // If cache is valid, use it and revalidate in background
    if (isCacheValid()) {
      setStats(cachedStats);
      setLoading(false);
      // Background revalidate after 500ms
      const timer = setTimeout(() => fetchStats(false), 500);
      return () => clearTimeout(timer);
    }
    // No valid cache — fetch fresh
    fetchStats(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for refresh events from the Header component
  useEffect(() => {
    const handler = () => fetchStats(true);
    window.addEventListener("dashboard-refresh", handler);
    return () => window.removeEventListener("dashboard-refresh", handler);
  }, [fetchStats]);

  return { stats, loading, refresh: () => fetchStats(true) };
}
