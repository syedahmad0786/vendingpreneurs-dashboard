"use client";
/**
 * Shared stroke icons used throughout the design (matches the Icon.* object
 * in the Claude Design bundle).
 */

export interface IconProps { size?: number; className?: string }

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className,
});

export const Icon = {
  Search: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  Bell: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  Help: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  ),
  Refresh: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  Plus: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  X: ({ size = 18, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Filter: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M3 5h18l-7 8v7l-4-2v-5z" />
    </svg>
  ),
  Sort: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M7 4v16M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" />
    </svg>
  ),
  Check: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2.2}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  ),
  Alert: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16v.5" />
    </svg>
  ),
  Clock: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Loader: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  ),
  External: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M14 4h6v6" />
      <path d="M10 14L20 4" />
      <path d="M20 14v6H4V4h6" />
    </svg>
  ),
  Download: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M12 3v12" />
      <path d="M6 10l6 6 6-6" />
      <path d="M4 21h16" />
    </svg>
  ),
  Activity: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
  Copy: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </svg>
  ),
  User: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  ChevronRight: ({ size = 14, className }: IconProps) => (
    <svg {...base(size, className)} strokeWidth={2}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  Moon: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  Sun: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </svg>
  ),
  Sliders: ({ size = 16, className }: IconProps) => (
    <svg {...base(size, className)}>
      <path d="M4 6h11M4 12h7M4 18h15" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="14" cy="12" r="2" />
      <circle cx="9" cy="18" r="2" />
    </svg>
  ),
};
