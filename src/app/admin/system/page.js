"use client";

import { useState, useEffect } from "react";
import {
  Server, Globe, AlertTriangle, Clock, Database, Activity, RefreshCw, Shield,
} from "lucide-react";
import { useAdminAuth } from "@/lib/use-admin-auth";

export default function AdminSystem() {
  const { isAdmin, loading: adminLoading, userId } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/system", {
          headers: { "x-account-id": userId },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load data");
        }
      } catch (e) {
        setError("Network error");
      }
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
        <RefreshCw size={24} className="spin" style={{ display: "inline-block", marginBottom: "var(--space-md)" }} />
        <div>Loading system health...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--accent-red)" }}>
        <h3>Error</h3>
        <p>{error || "No data"}</p>
      </div>
    );
  }

  const { health, webhooks, errors, rateLimits, database, activeConnections, auditEvents } = data;

  return (
    <>
      {/* Overall Health Status */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: health.status === "healthy" ? "rgba(0, 230, 118, 0.1)" : "rgba(248, 165, 50, 0.1)",
                color: health.status === "healthy" ? "var(--accent-green)" : "var(--accent-orange)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={32} />
              </div>
              <div>
                <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: 4 }}>System Status</h2>
                <span className={`health-indicator ${health.status}`}>
                  {health.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>Last Checked</div>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>{new Date(health.timestamp).toLocaleString()}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>Version {health.version}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Webhook Success</span>
            <div className="stat-card-icon green"><Globe size={18} /></div>
          </div>
          <div className="stat-card-value">{webhooks.successRate}%</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {webhooks.active} / {webhooks.total} active
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Errors (24h)</span>
            <div className="stat-card-icon admin-red"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-card-value">{errors.count24h}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {Object.keys(errors.byType).length} error types
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Rate Limit Hits (24h)</span>
            <div className="stat-card-icon admin-orange"><Clock size={18} /></div>
          </div>
          <div className="stat-card-value">{rateLimits.hits24h}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {Object.keys(rateLimits.byAction).length} actions limited
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">DB Total Records</span>
            <div className="stat-card-icon blue"><Database size={18} /></div>
          </div>
          <div className="stat-card-value">{database.totalRecords.toLocaleString()}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            Across {Object.keys(database.tableSizes).length} tables
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Webhook Delivery Stats */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Webhook Delivery</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
              <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-green)" }}>{webhooks.delivered}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Delivered</div>
              </div>
              <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-red)" }}>{webhooks.failed}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Failed</div>
              </div>
            </div>
            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-sm)" }}>
              <strong>Triggered Today:</strong> {webhooks.triggeredToday}
            </div>
            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-sm)" }}>
              <strong>Total Failures:</strong> {webhooks.totalFailures}
            </div>
            <div style={{ fontSize: "var(--font-size-sm)" }}>
              <strong>Delivery Rate:</strong> {webhooks.deliveryRate !== null ? `${webhooks.deliveryRate}%` : "N/A"}
            </div>
          </div>
        </div>

        {/* Error Log Summary */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Error Log</h3>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Last 24 hours</span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {Object.keys(errors.byType).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--accent-green)", padding: "var(--space-xl)", fontWeight: 600 }}>
                No errors in the last 24 hours!
              </div>
            ) : (
              <>
                {Object.entries(errors.byType).map(([type, count], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm)", marginBottom: 4, background: "var(--bg-glass)", borderRadius: "var(--radius-md)" }}>
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--accent-red)" }}>{type.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--accent-red)" }}>{count}</span>
                  </div>
                ))}
                {errors.recent?.length > 0 && (
                  <div style={{ marginTop: "var(--space-md)", paddingTop: "var(--space-md)", borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", textTransform: "uppercase" }}>Recent Errors</div>
                    {errors.recent.slice(0, 5).map((err, i) => (
                      <div key={i} style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: 4, padding: "var(--space-xs)", background: "var(--bg-glass)", borderRadius: 4 }}>
                        <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>{err.event_type}</span>
                        {" — "}
                        {err.details ? (typeof err.details === "string" ? err.details.slice(0, 80) : JSON.stringify(err.details).slice(0, 80)) : "No details"}
                        <span style={{ display: "block", fontSize: 9, marginTop: 2 }}>{new Date(err.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rate Limits + Database */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Rate Limits */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Rate Limit Hits</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {Object.keys(rateLimits.byAction).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--accent-green)", padding: "var(--space-xl)", fontWeight: 600 }}>
                No rate limit hits!
              </div>
            ) : (
              Object.entries(rateLimits.byAction).map(([action, count], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm)", marginBottom: 4, background: "var(--bg-glass)", borderRadius: "var(--radius-md)" }}>
                  <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>{action.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--accent-orange)" }}>{count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Database Table Sizes */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Database Tables</h3>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {Object.entries(database.tableSizes)
              .sort((a, b) => b[1] - a[1])
              .map(([table, count], i) => {
                const maxSize = database.tableSizes[Object.keys(database.tableSizes).sort((a, b) => database.tableSizes[b] - database.tableSizes[a])[0]];
                const pct = maxSize > 0 ? Math.round((count / maxSize) * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: i < Object.keys(database.tableSizes).length - 1 ? "var(--space-sm)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{table}</span>
                      <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{count.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--bg-glass)" }}>
                      <div style={{
                        height: "100%", borderRadius: 2, width: `${pct}%`,
                        background: "var(--accent-gradient)",
                        transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        opacity: 0.6,
                      }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Active Connections & Audit */}
      <div className="dashboard-panel" style={{ marginTop: "var(--space-lg)" }}>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xl)" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-md)" }}>Active Connections</div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <Activity size={24} style={{ color: "var(--accent-green)" }} />
                <div>
                  <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800 }}>{activeConnections.accountsActiveToday}</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>Accounts active today</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-md)" }}>Audit Events (7 days)</div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <Server size={24} style={{ color: "var(--accent-primary-light)" }} />
                <div>
                  <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800 }}>{auditEvents.total.toLocaleString()}</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    {Object.keys(auditEvents.byType).length} event types
                  </div>
                </div>
              </div>
              {Object.entries(auditEvents.byType).slice(0, 5).map(([type, count], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", padding: "2px 0", color: "var(--text-tertiary)" }}>
                  <span>{type.replace(/_/g, " ")}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
