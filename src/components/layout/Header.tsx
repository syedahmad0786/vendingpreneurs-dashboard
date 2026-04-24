"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow,
  Activity,
  Users,
  Settings,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";

/**
 * Nav items: production-ready pages only.
 * The other links (leads, national, revenue, quality) are hidden
 * behind a "Coming soon" splash.
 */
const NAV = [
  { label: "Pipeline", href: "/", icon: Workflow },
  { label: "Activity", href: "/onboarding", icon: Activity },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => setMobileOpen(false), [pathname]);

  // Add a subtle bottom-border lift when the user scrolls the page
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  return (
    <header
      className="sticky top-0 z-[60] w-full"
      style={{
        // Fully opaque — no bleed-through from the page content underneath.
        backgroundColor: "#0B1A10",
        boxShadow: scrolled ? "0 1px 0 rgba(244,199,26,0.14), 0 12px 24px -20px rgba(0,0,0,0.6)" : "0 1px 0 rgba(244,199,26,0.08)",
        transition: "box-shadow 200ms ease",
      }}
    >
      <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-10">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* ─── Logo + wordmark ─── */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden ring-1 ring-[#F4C71A]/25 shadow-lg shadow-[#1F6E2C]/40 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/brand/modern-amenities-mark.svg"
                alt="Modern Amenities"
                fill
                priority
                sizes="40px"
                className="object-cover"
              />
            </div>
            <div className="hidden sm:block leading-none">
              <h1 className="text-sm font-bold text-text-primary tracking-tight">
                Modern Amenities
              </h1>
              <p className="text-[10px] text-[#F4C71A] uppercase tracking-[0.22em] font-semibold mt-0.5">
                Onboarding Console
              </p>
            </div>
          </Link>

          {/* ─── Desktop nav ─── */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? "text-[#F4C71A] bg-[#F4C71A]/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"}
                  `}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-[#F4C71A]" : "text-text-muted"}`} />
                  <span>{item.label}</span>
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-[1px] left-3 right-3 h-0.5 bg-[#F4C71A] rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ─── Right side ─── */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-[11px] text-text-muted">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E8B3B] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E8B3B]" />
              </span>
              <span>Live</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 z-50 lg:hidden border-b border-[#F4C71A]/15"
              style={{ backgroundColor: "#0B1A10" }}
            >
              <nav className="max-w-[1600px] mx-auto px-6 py-3 space-y-1">
                {NAV.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                        ${active ? "bg-[#F4C71A]/10 text-[#F4C71A]" : "text-text-secondary hover:text-text-primary hover:bg-white/5"}`}
                    >
                      <Icon className={`w-5 h-5 ${active ? "text-[#F4C71A]" : "text-text-muted"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
