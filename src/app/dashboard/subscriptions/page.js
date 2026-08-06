"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import {
  RefreshCw, Plus, X, Loader2, Calendar, Package, User,
  Pause, Play, Trash2, Clock, TrendingUp, AlertCircle,
} from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { PageSkeleton } from "@/components/SkeletonLoader";

const FREQUENCY_OPTIONS = [7, 14, 30, 60, 90];
const STATUS_CONFIG = {
  active:  { label: "Active",   color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  paused:  { label: "Paused",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  cancelled:{ label: "Cancelled",color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  expired: { label: "Expired",  color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
};

export default function SubscriptionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveAccountId, loading: accountLoading } = useEffectiveAccount();
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [newSub, setNewSub] = useState({
    customer_id: "",
    product_id: "",
    variant: "",
    quantity: 1,
    frequency_days: 30,
    payment_method: "cod",
  });
  const [saving, setSaving] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    if (!effectiveAccountId) {
      if (!accountLoading) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id, customer_id, product_id, variant, quantity, frequency_days,
          next_order_at, status, total_orders, price_snapshot, payment_method,
          created_at, updated_at,
          customer:customers(id, name, email, phone),
          product:products(id, name, price)
        `)
        .eq("account_id", effectiveAccountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSubscriptions(data || []);
    } catch (e) {
      console.error("[SUBS] load error:", e);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [effectiveAccountId, accountLoading]);

  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);

  // Load customers + products when create modal opens
  useEffect(() => {
    if (showCreate && effectiveAccountId) {
      Promise.all([
        supabase.from("customers").select("id, name, email, phone").eq("account_id", effectiveAccountId).order("name").limit(100),
        supabase.from("products").select("id, name, price, stock").eq("account_id", effectiveAccountId).order("name").limit(100),
      ]).then(([custRes, prodRes]) => {
        setCustomers(custRes.data || []);
        setProducts(prodRes.data || []);
      });
    }
  }, [showCreate, effectiveAccountId]);

  const createSubscription = async () => {
    if (!newSub.customer_id || !newSub.product_id) {
      toast.error("Please select a customer and product");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newSub, account_id: effectiveAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Subscription created!");
      setShowCreate(false);
      loadSubscriptions();
    } catch (e) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSubscription = async (id, action) => {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Subscription ${action}d`);
      loadSubscriptions();
    } catch (e) {
      toast.error("Failed: " + e.message);
    }
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === "active").length,
    paused: subscriptions.filter(s => s.status === "paused").length,
    revenue: subscriptions.filter(s => s.status === "active")
      .reduce((sum, s) => sum + (s.price_snapshot || s.product?.price || 0) * (s.quantity || 1), 0),
  };

  if (loading) return <PageSkeleton showStats={true} />;

  return (
    <>
      <div className="page-header">
        <h1>Subscriptions</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Subscription
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Total Subscriptions", value: stats.total, icon: RefreshCw, color: "#5865F2" },
          { label: "Active", value: stats.active, icon: Play, color: "#10b981" },
          { label: "Paused", value: stats.paused, icon: Pause, color: "#f59e0b" },
          { label: "Recurring Revenue/mo", value: `${stats.revenue.toLocaleString()} EGP`, icon: TrendingUp, color: "#3BA55C" },
        ].map((stat, i) => (
          <div key={i} className="stat-card" style={{ padding: "var(--space-lg)", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <stat.icon size={16} color={stat.color} />
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Subscriptions list */}
      {subscriptions.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
          <RefreshCw size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <h3>No subscriptions yet</h3>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Create recurring order subscriptions for your customers.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create First Subscription
          </button>
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Frequency</th>
                    <th>Next Order</th>
                    <th>Status</th>
                    <th>Orders</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => {
                    const statusCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active;
                    return (
                      <tr key={sub.id}>
                        <td>{sub.customer?.name || "Unknown"}</td>
                        <td>{sub.product?.name || "Unknown"}</td>
                        <td>{sub.quantity}</td>
                        <td>Every {sub.frequency_days} days</td>
                        <td>{sub.next_order_at ? new Date(sub.next_order_at).toLocaleDateString() : "—"}</td>
                        <td>
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: statusCfg.bg, color: statusCfg.color }}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td>{sub.total_orders || 0}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            {sub.status === "active" && (
                              <button onClick={() => updateSubscription(sub.id, "pause")} title="Pause" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                <Pause size={14} color="#f59e0b" />
                              </button>
                            )}
                            {sub.status === "paused" && (
                              <button onClick={() => updateSubscription(sub.id, "resume")} title="Resume" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                <Play size={14} color="#10b981" />
                              </button>
                            )}
                            <button onClick={() => updateSubscription(sub.id, "cancel")} title="Cancel" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
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

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, width: "90%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3>New Subscription</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Customer</label>
                <select className="form-input" value={newSub.customer_id} onChange={e => setNewSub({ ...newSub, customer_id: e.target.value })}>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || c.email})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Product</label>
                <select className="form-input" value={newSub.product_id} onChange={e => setNewSub({ ...newSub, product_id: e.target.value })}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} EGP)</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Quantity</label>
                  <input type="number" className="form-input" min="1" value={newSub.quantity} onChange={e => setNewSub({ ...newSub, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Frequency (days)</label>
                  <select className="form-input" value={newSub.frequency_days} onChange={e => setNewSub({ ...newSub, frequency_days: parseInt(e.target.value) })}>
                    {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>Every {f} days</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>Payment Method</label>
                <select className="form-input" value={newSub.payment_method} onChange={e => setNewSub({ ...newSub, payment_method: e.target.value })}>
                  <option value="cod">Cash on Delivery</option>
                  <option value="paymob">Paymob (Online)</option>
                  <option value="instapay">InstaPay</option>
                  <option value="vodafone_cash">Vodafone Cash</option>
                </select>
              </div>
              <button className="btn btn-primary" disabled={saving || !newSub.customer_id || !newSub.product_id} onClick={createSubscription} style={{ marginTop: 8 }}>
                {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                {saving ? "Creating..." : "Create Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
