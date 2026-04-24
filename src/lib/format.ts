/**
 * Shared display formatters — consistency across every surface.
 */

const RTF = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
  ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  : null;

/**
 * Uniform relative-time formatter: "just now", "3 min ago", "17 hr ago", "2 days ago".
 */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const t = typeof iso === "string" ? new Date(iso).getTime() : NaN;
  if (isNaN(t)) return "—";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return RTF ? RTF.format(-diffMin, "minute") : `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return RTF ? RTF.format(-diffHr, "hour") : `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return RTF ? RTF.format(-diffDay, "day") : `${diffDay} days ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return RTF ? RTF.format(-diffMo, "month") : `${diffMo} months ago`;
  return RTF ? RTF.format(-Math.round(diffMo / 12), "year") : `${Math.round(diffMo / 12)} years ago`;
}

/**
 * Human-readable "13:40" style clock for "last updated" badges.
 */
export function clockTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Smart truncation — never cuts a word awkwardly, never leaves a trailing space.
 */
export function truncate(str: string | undefined | null, max = 26): string {
  if (!str) return "";
  const s = str.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  // Prefer cutting at the last whitespace to avoid "Email still i…"
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trimEnd()}…`;
}

/**
 * Compact number display: 1,200 → "1.2k", 12,500 → "12.5k"
 */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
