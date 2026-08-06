"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import {
  Shield, Search, Loader2, AlertTriangle, Lock, Activity,
  Filter, RefreshCw,
} from "lucide-react";
import { PageSkeleton } from "@/components/SkeletonLoader";

const EVENT_TYPE_LABELS = {
  invalid_hmac: { label: "Invalid Webhook Signature", color: "#ef4444" },
  login: { label: "Login", color: "#10b981" },
  logout: { label: "Logout", color: "#9ca3af" },
  settings_change: { label: "Settings Changed", color: "#f59e0b" },
  team_invite: { label: "Team Invite", color: "#3b82f6" },
  team_accept: { label: "Team Invite Accepted", color: "#10b981" },
  data_export: { label: "Data Export", color: "#a855f7" },
  api_key_created: { label: "API Key Created", color: "#6c5ce7" },
  api_key_revoked: { label: "API Key Revoked", color: "#ef4444" },
  account_deleted: { label: "Account Deleted", color: "#ef4444" },
};

export default function AuditLogsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadLogs = useCallback(async () => {
    if (!effectiveAccountId) {
      if (!accountLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, event_type, ip_address, route, details, created_at, user_id")
        .eq("account_id", effectiveAccountId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error("[AUDIT] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [effectiveAccountId, accountLoading]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filteredLogs = logs.filter(log => {
    if (filter !== "all" && log.event_type !== filter) return false;
    if (search) {
      const lower = search.toLowerCase();
      return JSON.stringify(log).toLowerCase().includes(lower);
    }
    return true;
  });

  const uniqueEventTypes = [...new Set(logs.map(l => l.event_type))];

  if (loading) return <PageSkeleton showStats={false} />;

  return (
    <>
      <div className="page-header">
        <h1>Audit Logs</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={loadLogs}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: "auto", minWidth: 180 }}
        >
          <option value="all">All Events</option>
          {uniqueEventTypes.map(type => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]?.label || type}
            </option>
          ))}
        </select>
      </div>

      {filteredLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
          <Shield size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <h3>No audit logs found</h3>
          <p style={{ fontSize: 13 }}>Security events will appear here as they occur.</p>
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>IP Address</th>
                    <th>Route</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const cfg = EVENT_TYPE_LABELS[log.event_type] || { label: log.event_type, color: "#9ca3af" };
                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: `${cfg.color}15`, color: cfg.color,
                          }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, fontFamily: "monospace" }}>{log.ip_address || "—"}</td>
                        <td style={{ fontSize: 12, fontFamily: "monospace" }}>{log.route || "—"}</td>
                        <td style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {log.details ? (typeof log.details === "string" ? log.details : JSON.stringify(log.details)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
