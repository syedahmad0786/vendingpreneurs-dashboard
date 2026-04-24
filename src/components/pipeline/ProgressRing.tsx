"use client";

/**
 * Circular progress ring — animated stroke, center shows "n/total".
 * Tuned for 44px size on lead cards and 120px size on the hero.
 */
export function ProgressRing({
  value,
  total,
  size = 44,
  stroke = 4,
  trackColor = "rgba(255,255,255,0.08)",
  color,
  label,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  color?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / Math.max(1, total)));
  const resolvedColor = color ?? (pct >= 1 ? "#4EB65E" : pct >= 0.5 ? "#F4C71A" : "#FB7185");

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 480ms cubic-bezier(0.22,1,0.36,1), stroke 240ms ease",
            filter: `drop-shadow(0 0 6px ${resolvedColor}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {label !== undefined ? (
          <span className="text-[10px] font-semibold text-text-secondary tabular">{label}</span>
        ) : (
          <span
            className="text-[11px] font-bold tabular leading-none"
            style={{ color: resolvedColor }}
          >
            {value}
            <span className="text-[9px] text-text-muted font-medium">/{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Large ring for the hero — shows a percentage in the middle.
 */
export function BigProgressRing({
  value,
  total,
  label,
  size = 140,
  color,
}: {
  value: number;
  total: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / Math.max(1, total)));
  const resolvedColor = color ?? "#4EB65E";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2E8B3B" />
            <stop offset="100%" stopColor="#F4C71A" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color ? resolvedColor : "url(#ringGrad)"}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 720ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="text-3xl font-bold tabular tracking-tight gradient-text">
          {Math.round(pct * 100)}%
        </span>
        {label && <span className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
