"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/**
 * Reusable stat card component
 * Props: title, value, change, changeType (positive/negative/neutral), icon, iconColor, loading
 */
export default function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "purple",
  loading = false,
  subtitle,
}) {
  if (loading) {
    return (
      <div className="stat-card">
        <div className="stat-card-header">
          <span className="stat-card-label" style={{ opacity: 0.3 }}>Loading...</span>
          <div className={`stat-card-icon ${iconColor}`} style={{ opacity: 0.3 }}>
            {Icon && <Icon size={18} />}
          </div>
        </div>
        <div style={{ height: 32, background: "var(--bg-glass)", borderRadius: 8, marginTop: "var(--space-md)" }} />
      </div>
    );
  }

  const changeIcon = changeType === "positive" ? ArrowUpRight : changeType === "negative" ? ArrowDownRight : Minus;
  const ChangeIcon = changeIcon;
  const changeClass = changeType === "positive" ? "up" : changeType === "negative" ? "down" : "";

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{title}</span>
        {Icon && (
          <div className={`stat-card-icon ${iconColor}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {change !== undefined && change !== null && (
        <div className="stat-card-change">
          <ChangeIcon size={12} />
          <span className={changeClass}>{change}</span>
        </div>
      )}
      {subtitle && !change && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-xs)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
