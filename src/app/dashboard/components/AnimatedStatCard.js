"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * AnimatedStatCard — stat card with count-up animation + sparkline.
 *
 * Props:
 *   label, value (number), formatFn (optional), icon, color, trend (number, %), sparkData (array of numbers)
 */
export default function AnimatedStatCard({ label, value = 0, formatFn, icon: Icon, color = "#5865F2", trend, sparkData = [] }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  // Intersection observer to trigger animation when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Count-up animation
  useEffect(() => {
    if (!isVisible) return;
    const duration = 800;
    const start = displayValue;
    const startTime = performance.now();
    let rafId;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (value - start) * eased);
      setDisplayValue(current);
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible, value]);

  const formatted = formatFn ? formatFn(displayValue) : displayValue.toLocaleString();
  const trendUp = trend > 0;
  const trendDown = trend < 0;

  // Build sparkline path
  const sparkPath = buildSparkPath(sparkData, 100, 28);

  return (
    <div
      ref={ref}
      style={{
        background: "var(--bg-card, rgba(33,34,44,0.7))",
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
        borderRadius: 14,
        padding: 16,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color + "40";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px -8px ${color}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle, rgba(255,255,255,0.06))";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Gradient glow on top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: color + "15",
        }}>
          {Icon && <Icon size={16} color={color} />}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: trendUp ? "rgba(59,165,92,0.1)" : "rgba(237,66,69,0.1)",
            color: trendUp ? "#3BA55C" : "#ED4245",
          }}>
            {trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 24, fontWeight: 800, color: "var(--text-primary, #fff)",
        marginBottom: 2,
      }}>
        {formatted}
      </div>

      {/* Label */}
      <div style={{ fontSize: 12, color: "var(--text-tertiary, rgba(255,255,255,0.4))", marginBottom: 8 }}>
        {label}
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <svg width="100%" height="28" viewBox="0 0 100 28" preserveAspectRatio="none" style={{ marginTop: 4 }}>
          <defs>
            <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {sparkPath && (
            <>
              <path d={`${sparkPath} L 100 28 L 0 28 Z`} fill={`url(#spark-${label})`} />
              <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

function buildSparkPath(data, width, height) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  return data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height * 0.8 - height * 0.1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
