"use client";
/**
 * Platform logo components — inline SVG with each platform's real brand colors.
 * Ported from the Claude Design bundle verbatim.
 */

import type { ComponentType } from "react";

export type PlatformId =
  | "close"
  | "email"
  | "airtable"
  | "mighty"
  | "intercom"
  | "vendhub";

interface LogoProps {
  size?: number;
  mono?: boolean;
}

export const PlatformLogos: Record<PlatformId, ComponentType<LogoProps>> = {
  close: ({ size = 20, mono = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="6" fill={mono ? "#000" : "#26be75"} />
      <path d="M22 11.5a6 6 0 1 0 0 9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  ),

  email: ({ size = 20, mono = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="6" fill={mono ? "#000" : "#3a6df0"} />
      <rect x="7" y="10" width="18" height="13" rx="2" stroke="#fff" strokeWidth="1.8" fill="none" />
      <path d="M8 11.5l8 6 8-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="23" cy="21" r="4" fill="#fff" />
      <path d="M21 21l1.5 1.5L25 20" stroke="#3a6df0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),

  airtable: ({ size = 20, mono = false }) =>
    mono ? (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#000" />
        <path d="M6 12l10-4 10 4-10 4z" fill="#fff" />
        <path d="M6 14v8l10 4v-8z" fill="#fff" opacity="0.75" />
        <path d="M26 14v8l-7 2.8v-7z" fill="#fff" opacity="0.55" />
      </svg>
    ) : (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#fff" />
        <path d="M6 12l10-4 10 4-10 4z" fill="#fcb400" />
        <path d="M6 14v8l10 4v-8z" fill="#18bfff" />
        <path d="M26 14v8l-7 2.8v-7z" fill="#f82b60" />
        <path d="M22 21.5l2-0.8v2.6l-2 0.8z" fill="#fff" />
      </svg>
    ),

  mighty: ({ size = 20, mono = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill={mono ? "#000" : "#6e3eff"} />
      <path d="M7 23V10l5 7 4-5 4 5 5-7v13" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),

  intercom: ({ size = 20, mono = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill={mono ? "#000" : "#1f8ded"} />
      <rect x="7" y="8" width="18" height="16" rx="3" fill="#fff" />
      <path d="M11 24v3l4-3" fill="#fff" />
      <line x1="11" y1="12" x2="11" y2="18" stroke="#1f8ded" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="15" y1="11" x2="15" y2="19" stroke="#1f8ded" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="19" y1="11" x2="19" y2="19" stroke="#1f8ded" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="23" y1="12" x2="23" y2="18" stroke="#1f8ded" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),

  vendhub: ({ size = 20, mono = false }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill={mono ? "#000" : "#e8552a"} />
      <rect x="9" y="7" width="14" height="18" rx="2" stroke="#fff" strokeWidth="1.6" fill="none" />
      <line x1="9" y1="14" x2="23" y2="14" stroke="#fff" strokeWidth="1.4" />
      <line x1="9" y1="19" x2="23" y2="19" stroke="#fff" strokeWidth="1.4" />
      <circle cx="13" cy="11" r="1" fill="#fff" />
      <circle cx="16.5" cy="11" r="1" fill="#fff" />
      <circle cx="20" cy="11" r="1" fill="#fff" />
      <rect x="18" y="21" width="4" height="2" fill="#fff" rx="0.5" />
    </svg>
  ),
};
