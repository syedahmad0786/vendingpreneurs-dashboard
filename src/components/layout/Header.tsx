"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Target,
  Globe,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Navigation items                                                   */
/* ------------------------------------------------------------------ */
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Onboarding", href: "/onboarding", icon: UserPlus },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Leads", href: "/leads", icon: Target },
  { label: "National", href: "/national", icon: Globe },
  { label: "Revenue", href: "/revenue", icon: DollarSign },
  { label: "Quality", href: "/quality", icon: ShieldCheck },
];

/* ------------------------------------------------------------------ */
/*  Header Component                                                   */
/* ------------------------------------------------------------------ */
export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Close mobile menu on route change — synchronizing UI with router state
  const prevPathnameRef = React.useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMobileOpen(false);
    }
  }, [pathname]);

  // Track minutes since last refresh
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
    window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full">
      <div className="glass-strong border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            {/* ─── Left: Logo ─── */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <LayoutDashboard className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-text-primary leading-tight tracking-tight">
                  VP Dashboard
                </h1>
                <p className="text-[10px] text-text-muted uppercase tracking-widest">
                  Vendingpreneurs
                </p>
              </div>
            </Link>

            {/* ─── Center: Desktop Navigation ─── */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${
                        active
                          ? "text-primary bg-primary/10"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-text-muted"}`} />
                    <span>{item.label}</span>
                    {active && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full"
                        transition={{ type: "spring" as const, stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ─── Right: Status + Refresh + Mobile Toggle ─── */}
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="hidden md:flex items-center gap-2 text-xs text-text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <span>
                  {minutesAgo === 0
                    ? "Just updated"
                    : `${minutesAgo}m ago`}
                </span>
              </div>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  text-text-secondary hover:text-text-primary hover:bg-white/5
                  transition-all duration-200 disabled:opacity-50"
                aria-label="Refresh data"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                aria-label="Toggle navigation"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile Dropdown Navigation ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            {/* Dropdown panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 right-0 z-50 lg:hidden glass-strong border-b border-white/10"
            >
              <nav className="max-w-[1600px] mx-auto px-6 py-3 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                        transition-all duration-200
                        ${
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                        }
                      `}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          active ? "text-primary" : "text-text-muted"
                        }`}
                      />
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
