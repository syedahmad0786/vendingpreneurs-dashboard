"use client";
/**
 * Lightweight inline-SVG charts ported from the Claude Design bundle.
 */

export interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, label, sublabel }: { segments: DonutSeg[]; label: string; sublabel: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 42, r = 30, cx = 50, cy = 50;
  let acc = 0;
  const arcs = segments.map((seg, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += seg.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const x3 = cx + r * Math.cos(end),   y3 = cy + r * Math.sin(end);
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start);
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    return <path key={i} d={d} fill={seg.color} />;
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg viewBox="0 0 100 100" style={{ width: 120, height: 120, flexShrink: 0 }}>
        {arcs}
        <text x="50" y="48" textAnchor="middle" fontSize="18" fontFamily="Fraunces, serif" fontWeight="700" fill="var(--fg-1)">{label}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="7" fill="var(--fg-3)" letterSpacing="1">{sublabel}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--fg-2)" }}>{s.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--fg-1)" }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  valueFmt = (v: number) => String(v),
}: {
  data: { label: string; value: number; color?: string }[];
  valueFmt?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 40px", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          <div style={{ height: 14, background: "var(--ma-line)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: d.color || "var(--ma-gold)", transition: "width .4s ease" }} />
          </div>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--fg-1)", textAlign: "right" }}>{valueFmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = "#e8c020", fill = true, height = 40 }: { values: number[]; color?: string; fill?: boolean; height?: number }) {
  if (!values.length) return null;
  const w = 200, h = height;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return [x, y] as [number, number];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      {fill && <path d={area} fill={color} opacity={0.15} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />}
    </svg>
  );
}

export function AreaTrend({
  series,
  height = 120,
}: {
  series: { label: string; values: number[]; color: string }[];
  height?: number;
}) {
  const w = 400, h = height;
  if (!series.length) return null;
  const len = series[0].values.length;
  const allVals = series.flatMap((s) => s.values);
  const max = Math.max(...allVals, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke="var(--ma-line)" strokeDasharray="2 4" />
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => {
          const x = (i / Math.max(1, len - 1)) * w;
          const y = h - (v / max) * (h - 8) - 4;
          return [x, y] as [number, number];
        });
        const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
        const area = `${line} L ${w} ${h} L 0 ${h} Z`;
        return (
          <g key={si}>
            <path d={area} fill={s.color} opacity={0.12} />
            <path d={line} fill="none" stroke={s.color} strokeWidth="2" />
          </g>
        );
      })}
    </svg>
  );
}
