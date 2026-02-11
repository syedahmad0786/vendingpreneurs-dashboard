"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* -------------------------------------------------- */
/*  Types                                             */
/* -------------------------------------------------- */
interface ColumnDef {
  key: string;
  label: string;
  render?: (value: any, record: any) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps {
  columns: ColumnDef[];
  data: any[];
  searchable?: boolean;
  searchFields?: string[];
  pageSize?: number;
  actions?: (record: any) => React.ReactNode;
  onRowClick?: (record: any) => void;
  loading?: boolean;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc" | null;

/* -------------------------------------------------- */
/*  DataTable                                         */
/* -------------------------------------------------- */
export default function DataTable({
  columns,
  data,
  searchable = false,
  searchFields,
  pageSize = 10,
  actions,
  onRowClick,
  loading = false,
  emptyMessage = "No results found.",
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /* ---- Filter ---- */
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    const fields = searchFields ?? columns.map((c) => c.key);
    return data.filter((row) =>
      fields.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(term);
      })
    );
  }, [data, search, searchFields, columns]);

  /* ---- Sort ---- */
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  /* ---- Pagination ---- */
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  /* ---- Sort handler ---- */
  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc"
        );
        if (sortDir === "desc") setSortKey(null);
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
      setCurrentPage(1);
    },
    [sortKey, sortDir]
  );

  /* ---- Sort icon ---- */
  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return (
        <ChevronsUpDown className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    if (sortDir === "asc") return <ChevronUp className="w-3 h-3 text-primary" />;
    return <ChevronDown className="w-3 h-3 text-primary" />;
  };

  /* ---- Skeleton rows ---- */
  if (loading) {
    return (
      <div className="glass-card overflow-hidden">
        {searchable && (
          <div className="p-4 border-b border-white/5">
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        )}
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {columns.map((col) => (
                <div key={col.key} className="skeleton h-5 flex-1 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-card overflow-hidden"
    >
      {/* Search bar */}
      {searchable && (
        <div className="p-5 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
            />
          </div>
        </div>
      )}

      {/* Table with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap ${
                    col.sortable
                      ? "cursor-pointer select-none group hover:text-text-secondary"
                      : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
              {actions && (
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <motion.tr
                  key={ri}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ri * 0.04, duration: 0.3 }}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors duration-150 ${
                    onRowClick ? "cursor-pointer hover:bg-white/5" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-5 py-3.5 text-sm text-text-secondary max-w-[200px] truncate"
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] != null
                          ? String(row[col.key])
                          : "-"}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-5 py-3.5 text-right">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/5">
          <p className="text-xs text-text-muted whitespace-nowrap">
            Showing {(safePage - 1) * pageSize + 1}
            {" - "}
            {Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (safePage <= 3) {
                page = i + 1;
              } else if (safePage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = safePage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-all duration-200 ${
                    page === safePage
                      ? "bg-primary text-white"
                      : "text-text-muted hover:text-text-primary hover:bg-white/5"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
