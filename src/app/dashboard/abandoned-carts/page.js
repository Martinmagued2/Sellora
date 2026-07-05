"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart, Search, Send, CheckCircle, Clock, X,
  ChevronRight, Loader2, Package, User, Tag, MessageSquare,
  ArrowRight, AlertCircle, RefreshCw, Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageSkeleton } from "@/components/SkeletonLoader";

const statusConfig = {
  abandoned: { color: "var(--accent-orange)", bg: "rgba(255, 145, 0, 0.1)", label: "Abandoned" },
  reminded: { color: "var(--accent-primary-light)", bg: "rgba(108, 92, 231, 0.1)", label: "Reminded" },
  recovered: { color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.1)", label: "Recovered" },
  expired: { color: "var(--text-tertiary)", bg: "rgba(255, 255, 255, 0.05)", label: "Expired" },
};

const channelConfig = {
  whatsapp: { emoji: "📱", label: "WhatsApp", class: "whatsapp" },
  instagram: { emoji: "📸", label: "Instagram", class: "instagram" },
  facebook: { emoji: "💬", label: "Facebook", class: "facebook" },
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return "N/A";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatCurrency(value) {
  return `${(parseFloat(value) || 0).toLocaleString()} EGP`;
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState([]);
  const [stats, setStats] = useState({
    totalAbandonedValue: 0,
    totalRecoveredValue: 0,
    activeCarts: 0,
    recoveredCarts: 0,
    totalCarts: 0,
    recoveryRate: 0,
  });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCarts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const params = new URLSearchParams({
        account_id: user.id,
        status: filter !== "all" ? filter : "",
        limit: "100",
      });

      const res = await fetch(`/api/abandoned-carts?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCarts(data.carts || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error("Fetch carts error:", err);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchCarts(); }, [fetchCarts]);

  // Filter carts by search
  const filteredCarts = carts.filter(cart => {
    if (!search) return true;
    const q = search.toLowerCase();
    const customerName = cart.customer?.name || "";
    const items = Array.isArray(cart.items) ? cart.items.map(i => i.name || i.title || "").join(" ") : "";
    return customerName.toLowerCase().includes(q) || items.toLowerCase().includes(q);
  });

  const handleSendReminder = async (cartId) => {
    setSendingReminder(cartId);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch("/api/abandoned-carts/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: user.id,
          cart_id: cartId,
          include_discount: false,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Reminder sent!");
        fetchCarts();
        // Update selected cart if viewing
        if (selectedCart?.id === cartId) {
          setSelectedCart(prev => ({ ...prev, status: "reminded", first_reminder_at: new Date().toISOString() }));
        }
      } else {
        showToast(data.error || "Failed to send reminder", "error");
      }
    } catch (err) {
      showToast("Error sending reminder: " + err.message, "error");
    }
    setSendingReminder(null);
  };

  const handleSendAllReminders = async () => {
    setSendingAll(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch("/api/abandoned-carts/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: user.id,
          send_all: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Sent ${data.sent} reminders! ${data.failed} failed.`, data.failed > 0 ? "warning" : "success");
        fetchCarts();
      } else {
        showToast(data.error || "Failed to send reminders", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    setSendingAll(false);
  };

  const handleMarkRecovered = async (cartId) => {
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch(`/api/abandoned-carts/${cartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: user.id,
          status: "recovered",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Cart marked as recovered!");
        fetchCarts();
        if (selectedCart?.id === cartId) {
          setSelectedCart(prev => ({ ...prev, status: "recovered", recovered_at: new Date().toISOString() }));
        }
      } else {
        showToast(data.error || "Failed to update", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch("/api/abandoned-carts/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: user.id, hours: 2 }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Detected ${data.detected} new abandoned cart(s)!`, data.detected > 0 ? "success" : "info");
        fetchCarts();
      } else {
        showToast(data.error || "Detection failed", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    setDetecting(false);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 80, right: 24, zIndex: 300,
          padding: "12px 20px", borderRadius: 12,
          background: toast.type === "error" ? "rgba(255, 82, 82, 0.95)" :
            toast.type === "warning" ? "rgba(255, 145, 0, 0.95)" :
            toast.type === "info" ? "rgba(0, 210, 255, 0.95)" :
            "rgba(0, 230, 118, 0.95)",
          color: "white", fontWeight: 600, fontSize: 13,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          animation: "fade-in-up 0.3s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.type === "error" ? <AlertCircle size={16} /> :
           toast.type === "success" ? <CheckCircle size={16} /> :
           <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShoppingCart size={28} style={{ color: "var(--accent-orange)" }} />
          Abandoned Carts
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleDetect} disabled={detecting}>
            {detecting ? <><Loader2 size={16} className="spin" /> Detecting...</> : <><RefreshCw size={16} /> Detect Carts</>}
          </button>
          <button className="btn btn-primary" onClick={handleSendAllReminders} disabled={sendingAll || stats.activeCarts === 0}>
            {sendingAll ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Send size={16} /> Send All Reminders</>}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(stats.totalAbandonedValue)}</div>
          <div className="stat-card-label">Total Abandoned Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.recoveryRate}%</div>
          <div className="stat-card-label">Recovery Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.activeCarts}</div>
          <div className="stat-card-label">Active Carts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <Package size={20} />
            </div>
          </div>
          <div className="stat-card-value">{formatCurrency(stats.totalRecoveredValue)}</div>
          <div className="stat-card-label">Recovered Revenue</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {[
            { key: "all", label: "All" },
            { key: "abandoned", label: "Abandoned" },
            { key: "reminded", label: "Reminded" },
            { key: "recovered", label: "Recovered" },
          ].map(f => (
            <button key={f.key} className={`filter-tab ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search by customer or items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Carts List */}
      <div className="dashboard-panel">
        <div className="dashboard-panel-body" style={{ padding: 0 }}>
          {loading ? (
            <PageSkeleton showStats={false} showTable={false} />
          ) : filteredCarts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <ShoppingCart size={36} />
              </div>
              <h3>No Abandoned Carts</h3>
              <p>{filter !== "all" ? "No carts match this filter." : "No abandoned carts detected yet. Click 'Detect Carts' to scan for new ones."}</p>
            </div>
          ) : (
            <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Items</th>
                  <th>Value</th>
                  <th>Abandoned</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCarts.map((cart) => {
                  const statusCfg = statusConfig[cart.status] || statusConfig.abandoned;
                  const channelCfg = channelConfig[cart.channel] || { emoji: "💬", label: cart.channel, class: "" };
                  const items = Array.isArray(cart.items) ? cart.items : [];
                  const itemsSummary = items.slice(0, 3).map(i => i.name || i.title || "Item").join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "");

                  return (
                    <tr key={cart.id} style={{ cursor: "pointer" }} onClick={() => setSelectedCart(cart)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "var(--accent-gradient)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: 12, flexShrink: 0,
                          }}>
                            {getInitials(cart.customer?.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                              {cart.customer?.name || "Unknown"}
                            </div>
                            {cart.customer?.email && (
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                {cart.customer.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`channel-badge ${channelCfg.class}`}>
                          {channelCfg.emoji} {channelCfg.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "var(--font-size-sm)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {itemsSummary || "No items"}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--accent-primary-light)" }}>
                        {formatCurrency(cart.cart_value)}
                      </td>
                      <td style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                        {formatTimeAgo(cart.abandoned_at)}
                      </td>
                      <td>
                        <span className="status-badge" style={{
                          background: statusCfg.bg,
                          color: statusCfg.color,
                        }}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          {(cart.status === "abandoned" || cart.status === "reminded") && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 11, padding: "4px 10px" }}
                              disabled={sendingReminder === cart.id}
                              onClick={() => handleSendReminder(cart.id)}
                            >
                              {sendingReminder === cart.id ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                              Remind
                            </button>
                          )}
                          {(cart.status === "abandoned" || cart.status === "reminded") && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: "4px 10px" }}
                              onClick={() => handleMarkRecovered(cart.id)}
                            >
                              <CheckCircle size={12} /> Recovered
                            </button>
                          )}
                          <button
                            className="topbar-btn"
                            style={{ width: 28, height: 28 }}
                            title="View details"
                            onClick={() => setSelectedCart(cart)}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Cart Detail Panel ═══ */}
      {selectedCart && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedCart(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={18} style={{ color: "var(--accent-orange)" }} />
                Cart Details
              </h3>
              <button className="modal-close" onClick={() => setSelectedCart(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {/* Status & Time */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
                <span className="status-badge" style={{
                  background: (statusConfig[selectedCart.status] || statusConfig.abandoned).bg,
                  color: (statusConfig[selectedCart.status] || statusConfig.abandoned).color,
                }}>
                  {(statusConfig[selectedCart.status] || statusConfig.abandoned).label}
                </span>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                  Abandoned {formatTimeAgo(selectedCart.abandoned_at)}
                </span>
              </div>

              {/* Customer Info */}
              <div style={{
                background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
                padding: "var(--space-md)", marginBottom: "var(--space-lg)",
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                  <User size={12} /> Customer
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "var(--accent-gradient)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14,
                  }}>
                    {getInitials(selectedCart.customer?.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedCart.customer?.name || "Unknown"}</div>
                    {selectedCart.customer?.email && <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>{selectedCart.customer.email}</div>}
                    {selectedCart.customer?.phone && <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{selectedCart.customer.phone}</div>}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className={`channel-badge ${channelConfig[selectedCart.channel]?.class || ""}`}>
                    {channelConfig[selectedCart.channel]?.emoji || "💬"} {channelConfig[selectedCart.channel]?.label || selectedCart.channel}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Package size={12} /> Items
                </div>
                {(Array.isArray(selectedCart.items) ? selectedCart.items : []).map((item, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "var(--space-sm) 0",
                    borderBottom: i < (selectedCart.items?.length || 0) - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {item.image ? (
                        <img src={item.image} alt={item.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: 40, height: 40, borderRadius: 8,
                          background: "var(--bg-tertiary)", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          color: "var(--text-tertiary)", fontSize: 18,
                        }}>
                          🛍️
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>{item.name || item.title || "Item"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Qty: {item.qty || 1}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
                      {formatCurrency((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1))}
                    </div>
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between", paddingTop: "var(--space-sm)",
                  marginTop: "var(--space-sm)", borderTop: "2px solid var(--border-medium)",
                }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: "var(--font-size-lg)", color: "var(--accent-green)" }}>
                    {formatCurrency(selectedCart.cart_value)}
                  </span>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock size={12} /> Timeline
                </div>
                <div style={{ paddingLeft: 16, borderLeft: "2px solid var(--border-subtle)" }}>
                  {/* Abandoned */}
                  <div style={{ position: "relative", padding: "4px 0 16px 16px" }}>
                    <div style={{
                      position: "absolute", left: -7, top: 6,
                      width: 12, height: 12, borderRadius: "50%",
                      background: "var(--accent-orange)", border: "2px solid var(--bg-primary)",
                    }} />
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Cart Abandoned</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {selectedCart.abandoned_at ? new Date(selectedCart.abandoned_at).toLocaleString() : "N/A"}
                    </div>
                  </div>

                  {/* First Reminder */}
                  <div style={{ position: "relative", padding: "4px 0 16px 16px" }}>
                    <div style={{
                      position: "absolute", left: -7, top: 6,
                      width: 12, height: 12, borderRadius: "50%",
                      background: selectedCart.first_reminder_at ? "var(--accent-primary-light)" : "var(--bg-tertiary)",
                      border: "2px solid var(--bg-primary)",
                    }} />
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: selectedCart.first_reminder_at ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      First Reminder
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {selectedCart.first_reminder_at ? new Date(selectedCart.first_reminder_at).toLocaleString() : "Not sent yet"}
                    </div>
                  </div>

                  {/* Second Reminder */}
                  <div style={{ position: "relative", padding: "4px 0 16px 16px" }}>
                    <div style={{
                      position: "absolute", left: -7, top: 6,
                      width: 12, height: 12, borderRadius: "50%",
                      background: selectedCart.second_reminder_at ? "var(--accent-primary-light)" : "var(--bg-tertiary)",
                      border: "2px solid var(--bg-primary)",
                    }} />
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: selectedCart.second_reminder_at ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      Second Reminder {selectedCart.coupon_code && `(+ Discount)`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {selectedCart.second_reminder_at ? new Date(selectedCart.second_reminder_at).toLocaleString() : "Not sent yet"}
                    </div>
                  </div>

                  {/* Recovered */}
                  <div style={{ position: "relative", padding: "4px 0 0 16px" }}>
                    <div style={{
                      position: "absolute", left: -7, top: 6,
                      width: 12, height: 12, borderRadius: "50%",
                      background: selectedCart.recovered_at ? "var(--accent-green)" : "var(--bg-tertiary)",
                      border: "2px solid var(--bg-primary)",
                    }} />
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: selectedCart.recovered_at ? "var(--accent-green)" : "var(--text-tertiary)" }}>
                      Recovered
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {selectedCart.recovered_at ? new Date(selectedCart.recovered_at).toLocaleString() : "Not recovered yet"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coupon Code */}
              {selectedCart.coupon_code && (
                <div style={{
                  background: "rgba(255, 145, 0, 0.08)", borderRadius: "var(--radius-md)",
                  padding: "var(--space-md)", marginBottom: "var(--space-lg)",
                  border: "1px solid rgba(255, 145, 0, 0.2)",
                }}>
                  <div style={{ fontSize: 11, color: "var(--accent-orange)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Tag size={12} /> Coupon Code
                  </div>
                  <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 800, fontFamily: "monospace", color: "var(--accent-orange)" }}>
                    {selectedCart.coupon_code}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Quick Actions */}
            <div className="modal-footer" style={{ flexWrap: "wrap", gap: "var(--space-sm)" }}>
              {(selectedCart.status === "abandoned" || selectedCart.status === "reminded") && (
                <>
                  <button
                    className="btn btn-primary"
                    disabled={sendingReminder === selectedCart.id}
                    onClick={() => handleSendReminder(selectedCart.id)}
                  >
                    {sendingReminder === selectedCart.id ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    {selectedCart.status === "abandoned" ? "Send Reminder" : "Send Second Reminder"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleMarkRecovered(selectedCart.id)}
                  >
                    <CheckCircle size={16} /> Mark Recovered
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedCart(null)}>Close</button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
