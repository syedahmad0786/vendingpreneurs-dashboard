"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ExternalLink, CheckCircle, XCircle, Loader2 } from "lucide-react";

/* ====================================================
   ResubmitButton
   ==================================================== */

interface ResubmitButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: { id: string; fields: Record<string, any> };
  onSuccess?: () => void;
}

type ResubmitStatus = "idle" | "loading" | "success" | "error";

export function ResubmitButton({ record, onSuccess }: ResubmitButtonProps) {
  const [status, setStatus] = useState<ResubmitStatus>("idle");
  const [message, setMessage] = useState("");

  const handleClick = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resubmit",
          payload: {
            "Full Name": record.fields["Full Name"],
            Email: record.fields["Email"],
            "Program Tier": record.fields["Program Tier"],
            "Client ID": record.fields["Client ID"],
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      setStatus("success");
      setMessage("Resubmitted successfully");
      onSuccess?.();
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    }
  }, [record, onSuccess]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={status === "loading" || status === "success"}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "loading" ? (
            <motion.span
              key="spin"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </motion.span>
          ) : status === "success" ? (
            <motion.span
              key="ok"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckCircle className="w-3.5 h-3.5 text-success" />
            </motion.span>
          ) : status === "error" ? (
            <motion.span
              key="err"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <XCircle className="w-3.5 h-3.5 text-danger" />
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
        <span>
          {status === "loading"
            ? "Resubmitting..."
            : status === "success"
              ? "Done"
              : status === "error"
                ? "Failed"
                : "Resubmit"}
        </span>
      </button>

      {/* Inline notification */}
      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className={`text-xs leading-tight ${
              status === "success" ? "text-success" : "text-danger"
            }`}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====================================================
   OpenLeadButton
   ==================================================== */

interface OpenLeadButtonProps {
  recordId: string;
  tableId?: string;
}

const DEFAULT_TABLE_ID = "tblMLFYTeoqrtmgXQ";

export function OpenLeadButton({
  recordId,
  tableId = DEFAULT_TABLE_ID,
}: OpenLeadButtonProps) {
  const url = `https://airtable.com/appgqED05AlPLi0ar/${tableId}/${recordId}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-text-secondary border border-white/10 hover:text-text-primary hover:border-white/20 hover:bg-white/5 transition-all duration-200"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>Open in Airtable</span>
    </a>
  );
}
