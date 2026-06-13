"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Webhook, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  Loader2, Plus, Trash2, ExternalLink, ChevronRight, ArrowLeft,
  Activity, Zap, Shield, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

const STATUS_CONFIG = {
  success: { label: "Success", color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.1)", icon: CheckCircle },
  failed: { label: "Failed", color: "var(--accent-red)", bg: "rgba(255, 82, 82, 0.1)", icon: XCircle },
  pending: { label: "Pending", color: "var(--accent-orange)", bg: "rgba(255, 145, 0, 0.1)", icon: Clock },
  retrying: { label: "Retrying", color: "var(--accent-primary-light)", bg: "rgba(108, 92, 231, 0.1)", icon: RefreshCw },
};

export default function WebhooksPage() {
  const toast = useToast();
  
  const confirmAction = useConfirm();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [retryingId, setRetryingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ url: "", events: ["order.created"], secret: "" });
  const pollRef = useRef(null);

  const supabase = createClient();

  // Fetch all webhooks with delivery stats
  const fetchWebhooks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("account_webhooks")
      .select("*")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // Get delivery stats for each webhook
      const webhooksWithStats = await Promise.all(
        data.map(async (wh) => {
          const [successRes, failedRes, pendingRes] = await Promise.all([
            supabase.from("webhook_deliveries").select("id", { count: "exact", head: true }).eq("webhook_id", wh.id).eq("status", "success"),
            supabase.from("webhook_deliveries").select("id", { count: "exact", head: true }).eq("webhook_id", wh.id).eq("status", "failed"),
            supabase.from("webhook_deliveries").select("id", { count: "exact", head: true }).eq("webhook_id", wh.id).in("status", ["pending", "retrying"]),
          ]);
          return {
            ...wh,
            stats: {
              success: successRes.count || 0,
              failed: failedRes.count || 0,
              pending: (pendingRes.count || 0),
            },
          };
        })
      );
      setWebhooks(webhooksWithStats);
    }
    setLoading(false);
  }, []);

  // Fetch deliveries for a selected webhook
  const fetchDeliveries = useCallback(async (webhookId, page = 1, status = statusFilter) => {
    setDeliveriesLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (webhookId) params.set("webhook_id", webhookId);
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/webhooks/deliveries?${params}`);
      const data = await res.json();
      if (data.success) {
        setDeliveries(data.deliveries || []);
        setDeliveryTotal(data.pagination?.total || 0);
        setDeliveryPage(page);
      }
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    }
    setDeliveriesLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // Fetch deliveries when selected webhook or filter changes
  useEffect(() => {
    if (selectedWebhook !== null) {
      fetchDeliveries(selectedWebhook, 1, statusFilter);
    }
  }, [selectedWebhook, statusFilter, fetchDeliveries]);

  // Auto-refresh every 10s when there are pending deliveries
  useEffect(() => {
    const hasPending = deliveries.some(d => d.status === "pending" || d.status === "retrying");
    if (hasPending && selectedWebhook) {
      pollRef.current = setInterval(() => {
        fetchDeliveries(selectedWebhook, deliveryPage, statusFilter);
      }, 10000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deliveries, selectedWebhook, deliveryPage, statusFilter, fetchDeliveries]);

  const handleRetry = async (deliveryId) => {
    setRetryingId(deliveryId);
    try {
      const res = await fetch(`/api/webhooks/deliveries/${deliveryId}/retry`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Refresh deliveries and webhook stats
        fetchDeliveries(selectedWebhook, deliveryPage, statusFilter);
        fetchWebhooks();
      } else {
        toast.error(data.error || "Failed to retry delivery");
      }
    } catch (err) {
      toast.error("Failed to retry: " + err.message);
    }
    setRetryingId(null);
  };

  const handleDeleteWebhook = async (whId) => {
    if (!(await confirmAction("Delete this webhook? All delivery logs will also be removed."))) return;
    await supabase.from("account_webhooks").delete().eq("id", whId);
    if (selectedWebhook === whId) setSelectedWebhook(null);
    fetchWebhooks();
  };

  const handleToggleWebhook = async (wh) => {
    await supabase.from("account_webhooks").update({ is_active: !wh.is_active }).eq("id", wh.id);
    fetchWebhooks();
  };

  const handleTestWebhook = async (wh) => {
    setTestingId(wh.id);
    try {
      const event = wh.events?.[0] || "order.created";
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId: wh.id, event }),
      });
      const data = await res.json();
      if (data.success && data.results?.[0]) {
        const result = data.results[0];
        if (result.ok) {
          toast.success(`Test sent! Got ${result.status} in ${result.durationMs}ms`);
        } else {
          toast.error(`Test failed: ${result.error || `HTTP ${result.status}`}`);
        }
      } else {
        toast.error(data.error || "Test failed");
      }
      fetchWebhooks();
      if (selectedWebhook) fetchDeliveries(selectedWebhook, deliveryPage, statusFilter);
    } catch (err) {
      toast.error("Test failed: " + err.message);
    }
    setTestingId(null);
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!newWebhook.url.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("account_webhooks").insert({
      account_id: user.id,
      url: newWebhook.url.trim(),
      events: newWebhook.events,
      secret: newWebhook.secret || null,
      is_active: true,
    });

    if (!error) {
      setShowCreateModal(false);
      setNewWebhook({ url: "", events: ["order.created"], secret: "" });
      fetchWebhooks();
    } else {
      toast.error("Failed to create webhook: " + error.message);
    }
    setCreating(false);
  };

  const toggleEvent = (event) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const AVAILABLE_EVENTS = [
    "order.created",
    "order.updated",
    "message.received",
    "customer.created",
  ];

  const formatDate = (d) => new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const totalDeliveries = deliveryTotal;
  const totalPages = Math.ceil(totalDeliveries / 20);

  // ───── Webhook List View ─────
  if (!selectedWebhook) {
    return (
      <>
        <div className="page-header">
          <h1>Webhooks</h1>
          <div className="page-header-actions">
            <button className="btn btn-secondary" onClick={fetchWebhooks}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Add Webhook
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid" style={{ marginBottom: "var(--space-xl)" }}>
          {[
            {
              label: "Active Webhooks",
              value: webhooks.filter((w) => w.is_active).length,
              icon: <Webhook size={18} />,
              color: "purple",
            },
            {
              label: "Total Deliveries",
              value: webhooks.reduce((sum, w) => sum + (w.stats?.success || 0) + (w.stats?.failed || 0) + (w.stats?.pending || 0), 0),
              icon: <Activity size={18} />,
              color: "blue",
            },
            {
              label: "Failed Deliveries",
              value: webhooks.reduce((sum, w) => sum + (w.stats?.failed || 0), 0),
              icon: <AlertTriangle size={18} />,
              color: "orange",
            },
            {
              label: "Success Rate",
              value: (() => {
                const totalSuccess = webhooks.reduce((s, w) => s + (w.stats?.success || 0), 0);
                const totalAll = webhooks.reduce((s, w) => s + (w.stats?.success || 0) + (w.stats?.failed || 0), 0);
                return totalAll > 0 ? `${Math.round((totalSuccess / totalAll) * 100)}%` : "—";
              })(),
              icon: <Zap size={18} />,
              color: "green",
            },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">{s.label}</span>
                <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
              </div>
              <div className="stat-card-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Webhook List */}
        {loading ? (
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
            <Loader2 size={24} className="spin" style={{ display: "inline-block" }} /> Loading webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="dashboard-panel" style={{ padding: "var(--space-4xl)", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(108, 92, 231, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-xl)", color: "var(--accent-primary)" }}>
              <Webhook size={32} />
            </div>
            <h3 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-sm)" }}>No Webhooks Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xl)", maxWidth: 400, margin: "0 auto var(--space-xl)" }}>
              Create a webhook endpoint to receive real-time notifications when events happen in your store.
            </p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Create Your First Webhook
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {webhooks.map((wh) => (
              <div key={wh.id} className="dashboard-panel webhook-card" style={{ cursor: "pointer" }} onClick={() => setSelectedWebhook(wh.id)}>
                <div style={{ padding: "var(--space-xl)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)" }}>
                      <Webhook size={18} style={{ color: wh.is_active ? "var(--accent-green)" : "var(--text-tertiary)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: "var(--font-size-base)" }}>{wh.url}</span>
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: wh.is_active ? "rgba(0, 230, 118, 0.1)" : "rgba(255, 255, 255, 0.05)",
                        color: wh.is_active ? "var(--accent-green)" : "var(--text-tertiary)",
                        border: `1px solid ${wh.is_active ? "rgba(0, 230, 118, 0.3)" : "var(--border-subtle)"}`,
                      }}>
                        {wh.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-lg)", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", flexWrap: "wrap" }}>
                      <span>Events: {(wh.events || []).join(", ")}</span>
                      {wh.last_triggered_at && (
                        <span>Last triggered: {formatDate(wh.last_triggered_at)}</span>
                      )}
                    </div>
                    {/* Delivery stats mini bar */}
                    <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
                      {[
                        { label: "Success", value: wh.stats?.success || 0, color: "var(--accent-green)" },
                        { label: "Failed", value: wh.stats?.failed || 0, color: "var(--accent-red)" },
                        { label: "Pending", value: wh.stats?.pending || 0, color: "var(--accent-orange)" },
                      ].map((s, i) => (
                        <span key={i} style={{
                          padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: `${s.color}15`, color: s.color,
                        }}>
                          {s.value} {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-xs)", marginLeft: "var(--space-lg)" }}>
                    <button
                      className="topbar-btn"
                      title="Send test event"
                      onClick={(e) => { e.stopPropagation(); handleTestWebhook(wh); }}
                      disabled={testingId === wh.id}
                      style={{ color: "var(--accent-primary-light)" }}
                    >
                      {testingId === wh.id ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                    </button>
                    <button
                      className="topbar-btn"
                      title="View deliveries"
                      onClick={(e) => { e.stopPropagation(); setSelectedWebhook(wh.id); }}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      className="topbar-btn"
                      title={wh.is_active ? "Disable" : "Enable"}
                      onClick={(e) => { e.stopPropagation(); handleToggleWebhook(wh); }}
                      style={{ color: wh.is_active ? "var(--accent-orange)" : "var(--accent-green)" }}
                    >
                      {wh.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    </button>
                    <button
                      className="topbar-btn"
                      title="Delete webhook"
                      onClick={(e) => { e.stopPropagation(); handleDeleteWebhook(wh.id); }}
                      style={{ color: "var(--accent-red)" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Webhook Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
            <div className="modal" style={{ maxWidth: 520 }}>
              <div className="modal-header">
                <h3>Create Webhook</h3>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleCreateWebhook}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Endpoint URL</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://your-server.com/webhooks/sellora"
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                      required
                    />
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                      The URL where Sellora will send HTTP POST requests
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Events</label>
                    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                      {AVAILABLE_EVENTS.map((event) => (
                        <button
                          key={event}
                          type="button"
                          className={`filter-tab ${newWebhook.events.includes(event) ? "active" : ""}`}
                          onClick={() => toggleEvent(event)}
                          style={{ fontSize: "var(--font-size-xs)" }}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Shield size={14} /> Signing Secret (optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="whsec_..."
                      value={newWebhook.secret}
                      onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                    />
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                      If set, each delivery will include an X-Sellora-Signature header with HMAC-SHA256
                    </p>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating || !newWebhook.url.trim() || newWebhook.events.length === 0}>
                    {creating ? <><Loader2 size={14} className="spin" /> Creating...</> : <><Webhook size={14} /> Create Webhook</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // ───── Delivery Log View ─────
  const selectedWh = webhooks.find((w) => w.id === selectedWebhook);

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <button className="topbar-btn" onClick={() => setSelectedWebhook(null)} title="Back to webhooks">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: "var(--font-size-xl)" }}>Delivery Log</h1>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", marginTop: 2 }}>
              {selectedWh?.url}
            </p>
          </div>
        </div>
        <div className="page-header-actions">
          <div className="filter-tabs">
            {["all", "success", "failed", "pending"].map((f) => (
              <button
                key={f}
                className={`filter-tab ${statusFilter === f ? "active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={() => fetchDeliveries(selectedWebhook, deliveryPage, statusFilter)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Delivery stats for selected webhook */}
      {selectedWh && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
          {[
            { label: "Success", value: selectedWh.stats?.success || 0, color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.1)" },
            { label: "Failed", value: selectedWh.stats?.failed || 0, color: "var(--accent-red)", bg: "rgba(255, 82, 82, 0.1)" },
            { label: "Pending", value: selectedWh.stats?.pending || 0, color: "var(--accent-orange)", bg: "rgba(255, 145, 0, 0.1)" },
            { label: "Last Status", value: selectedWh.last_status_code || "—", color: selectedWh.last_status_code >= 200 && selectedWh.last_status_code < 300 ? "var(--accent-green)" : "var(--text-tertiary)", bg: "var(--bg-glass)" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "var(--space-md) var(--space-lg)",
              background: s.bg,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries Table */}
      {deliveriesLoading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
          <Loader2 size={24} className="spin" style={{ display: "inline-block" }} /> Loading deliveries...
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Duration</th>
                    <th>Attempts</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((del) => {
                    const statusConf = STATUS_CONFIG[del.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConf.icon;
                    return (
                      <tr key={del.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: "var(--font-size-xs)", color: "var(--text-secondary)" }}>
                          {formatDate(del.created_at)}
                        </td>
                        <td>
                          <span style={{
                            padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: "rgba(108, 92, 231, 0.1)", color: "var(--accent-primary-light)",
                          }}>
                            {del.event}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: statusConf.bg, color: statusConf.color,
                          }}>
                            <StatusIcon size={12} />
                            {statusConf.label}
                          </span>
                        </td>
                        <td style={{ fontSize: "var(--font-size-sm)", color: del.response_status >= 200 && del.response_status < 300 ? "var(--accent-green)" : del.response_status ? "var(--accent-red)" : "var(--text-tertiary)" }}>
                          {del.response_status || "—"}
                        </td>
                        <td style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          {del.duration_ms ? `${del.duration_ms}ms` : "—"}
                        </td>
                        <td style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                          {del.attempts || 1}
                        </td>
                        <td>
                          {(del.status === "failed" || del.status === "retrying") && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "4px 10px", fontSize: "var(--font-size-xs)" }}
                              onClick={() => handleRetry(del.id)}
                              disabled={retryingId === del.id}
                            >
                              {retryingId === del.id ? (
                                <><Loader2 size={12} className="spin" /> Retrying...</>
                              ) : (
                                <><RefreshCw size={12} /> Retry</>
                              )}
                            </button>
                          )}
                          {del.response_body && (
                            <button
                              className="topbar-btn"
                              title="View response"
                              onClick={() => toast.info(`Response Body: ${del.response_body?.substring(0, 200)}...`) }
                              style={{ marginLeft: 4 }}
                            >
                              <ExternalLink size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {deliveries.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: "var(--space-2xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
                        No deliveries found {statusFilter !== "all" ? `with status "${statusFilter}"` : ""}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-md) var(--space-lg)", borderTop: "1px solid var(--border-subtle)",
            }}>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                Showing {((deliveryPage - 1) * 20) + 1}–{Math.min(deliveryPage * 20, totalDeliveries)} of {totalDeliveries}
              </span>
              <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "var(--font-size-xs)" }}
                  disabled={deliveryPage <= 1}
                  onClick={() => fetchDeliveries(selectedWebhook, deliveryPage - 1, statusFilter)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "var(--font-size-xs)" }}
                  disabled={deliveryPage >= totalPages}
                  onClick={() => fetchDeliveries(selectedWebhook, deliveryPage + 1, statusFilter)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
