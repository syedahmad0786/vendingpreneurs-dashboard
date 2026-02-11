"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface LeadData {
  client_id: string;
  full_name: string;
  best_email: string;
  error_record_id: string;
  original_error: string;
}

interface ResubmitButtonProps {
  leadData: LeadData;
}

type Status = "idle" | "loading" | "success" | "error";

export default function ResubmitButton({ leadData }: ResubmitButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const handleResubmit = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resubmit",
          ...leadData,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }, [leadData]);
  return (
    <div className="relative inline-flex flex-col items-start">
      <button
        onClick={handleResubmit}
        disabled={status === "loading" || status === "success"}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
          transition-all duration-200
          ${
            status === "success"
              ? "bg-success/20 text-success border border-success/30"
              : status === "error"
              ? "bg-danger/20 text-danger border border-danger/30"
              : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        <AnimatePresence mode="wait">
          {status === "loading" && (
            <motion.span
              key="loading"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
            </motion.span>
          )}          {status === "success" && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <CheckCircle className="w-4 h-4" />
            </motion.span>
          )}
          {status === "error" && (
            <motion.span
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <XCircle className="w-4 h-4" />
            </motion.span>
          )}
          {status === "idle" && (
            <motion.span
              key="idle"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.span>
          )}
        </AnimatePresence>        <span>
          {status === "loading"
            ? "Resubmitting..."
            : status === "success"
            ? "Resubmitted"
            : status === "error"
            ? "Failed"
            : "Resubmit"}
        </span>
      </button>

      {/* Error toast */}
      <AnimatePresence>
        {status === "error" && errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full left-0 mt-2 px-3 py-2 rounded-lg bg-danger/20 border border-danger/30 text-xs text-danger max-w-[250px] z-10"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}