"use client";

import { useMemo } from "react";

/**
 * Lightweight SVG charts — no external dependencies (Recharts not installed).
 * Renders inline SVG sparklines, bar charts, and donut charts.
 */

// ─── Line Chart (revenue trend) ───
export function LineChart({ data = [], color = "#5865F2", height = 120, label = "Revenue" }) {
  if (!data || data.length < 2) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 12 }}>Not enough data</div>;

  const width = 100;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * step,
    y: height - ((d.value - min) / range) * height * 0.8 - height * 0.1,
    label: d.label,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`line-grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#line-grad-${label})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="0.8" fill={color} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-tertiary)" }}>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// ─── Donut Chart (channel distribution) ───
export function DonutChart({ data = [], size = 120 }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = 40;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circumference;
          const circle = (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="none" stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          );
          offset += dash;
          return circle;
        })}
        <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{total}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">Total</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{d.value}</span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>({Math.round(d.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart (funnel) ───
export function BarChart({ data = [], height = 200 }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value)) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const convPct = i > 0 ? Math.round((d.value / data[i - 1].value) * 100) : 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{d.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {d.value}
                {i > 0 && <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginLeft: 6 }}>{convPct}%</span>}
              </span>
            </div>
            <div style={{ height: 24, borderRadius: 6, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: d.color || "var(--accent-gradient)",
                borderRadius: 6,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gauge Chart (AI deflection) ───
export function GaugeChart({ value = 0, max = 100, label = "AI Deflection", color = "#00D2FF" }) {
  const pct = Math.min(value / max, 1);
  const angle = pct * 180; // semicircle
  const radius = 45;
  const circumference = Math.PI * radius; // half circle

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="120" height="80" viewBox="0 0 100 60">
        <path d="M 10 55 A 45 45 0 0 1 90 55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 55 A 45 45 0 0 1 90 55"
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${pct * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">{value}%</text>
      </svg>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{label}</span>
    </div>
  );
}
