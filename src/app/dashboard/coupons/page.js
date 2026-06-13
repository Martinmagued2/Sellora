"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Loader2, Copy, Trash2, Edit, Check, Tag, Percent,
  DollarSign, Truck, Clock, Calendar, AlertCircle, RefreshCw,
  ToggleLeft, ToggleRight, Search, Gift,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/ToastProvider";
import { getPlanLimits, isLimitExceeded } from "@/lib/plan-limits";
import { PageSkeleton } from "@/components/SkeletonLoader";

const TYPE_CONFIG = {
  percentage: { label: "Percentage", icon: <Percent size={14} />, color: "var(--accent-primary-light)", bg: "rgba(108, 92, 231, 0.12)" },
  fixed: { label: "Fixed Amount", icon: <DollarSign size={14} />, color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.12)" },
  free_shipping: { label: "Free Shipping", icon: <Truck size={14} />, color: "var(--accent-secondary)", bg: "rgba(0, 210, 255, 0.12)" },
};

const APPLIES_TO_LABELS = {
  all: "All Products",
  specific_products: "Specific Products",
  specific_categories: "Specific Categories",
};

function generateCouponCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function CouponsPage() {
  const toast = useToast();
  const router = useRouter();
  const [coupons, setCoupons] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [accountPlan, setAccountPlan] = useState("starter");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form state
  const [form, setForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    min_order_value: "",
    max_uses: "",
    starts_at: "",
    expires_at: "",
    applies_to: "all",
    is_active: true,
  });

  const supabase = createClient();
  const planLimits = getPlanLimits(accountPlan);
  const couponLimit = planLimits.coupons !== undefined ? planLimits.coupons : 3;
  const limitReached = couponLimit !== -1 && coupons.length >= couponLimit;

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (account?.plan) setAccountPlan(account.plan);
    }

    let query = supabase.from("coupons").select("*").order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("code", `%${search.toUpperCase()}%`);
    }

    const { data, error } = await query;
    if (!error) {
      setCoupons(data || []);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  // Filter coupons client-side
  const filteredCoupons = coupons.filter((c) => {
    if (filter === "active") return c.is_active && !isExpired(c) && !isExhausted(c);
    if (filter === "expired") return isExpired(c);
    if (filter === "exhausted") return isExhausted(c);
    if (filter === "inactive") return !c.is_active;
    return true;
  });

  function isExpired(c) {
    return c.expires_at && new Date(c.expires_at) < new Date();
  }

  function isExhausted(c) {
    return c.max_uses !== null && c.used_count >= c.max_uses;
  }

  function getCouponStatus(c) {
    if (!c.is_active) return { label: "Inactive", color: "var(--text-tertiary)", bg: "var(--bg-glass)" };
    if (isExpired(c)) return { label: "Expired", color: "var(--accent-red)", bg: "rgba(255, 82, 82, 0.1)" };
    if (isExhausted(c)) return { label: "Exhausted", color: "var(--accent-orange)", bg: "rgba(255, 145, 0, 0.1)" };
    if (c.starts_at && new Date(c.starts_at) > new Date()) return { label: "Scheduled", color: "var(--accent-secondary)", bg: "rgba(0, 210, 255, 0.1)" };
    return { label: "Active", color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.1)" };
  }

  function formatDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatValue(c) {
    if (c.type === "percentage") return `${c.value}%`;
    if (c.type === "fixed") return `${parseFloat(c.value).toFixed(2)} EGP`;
    if (c.type === "free_shipping") return "Free";
    return c.value;
  }

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setForm({
      code: generateCouponCode(),
      type: "percentage",
      value: "",
      min_order_value: "",
      max_uses: "",
      starts_at: "",
      expires_at: "",
      applies_to: "all",
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      min_order_value: coupon.min_order_value || "",
      max_uses: coupon.max_uses || "",
      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : "",
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 16) : "",
      applies_to: coupon.applies_to || "all",
      is_active: coupon.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) return;
    setSaving(true);

    try {
      if (editingCoupon) {
        // Update via API
        const res = await fetch(`/api/coupons/${editingCoupon.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: form.code,
            type: form.type,
            value: parseFloat(form.value),
            min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
            max_uses: form.max_uses ? parseInt(form.max_uses) : null,
            starts_at: form.starts_at || null,
            expires_at: form.expires_at || null,
            applies_to: form.applies_to,
            is_active: form.is_active,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to update coupon");
          setSaving(false);
          return;
        }
      } else {
        // Create via API
        const res = await fetch("/api/coupons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: form.code,
            type: form.type,
            value: parseFloat(form.value),
            min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
            max_uses: form.max_uses ? parseInt(form.max_uses) : null,
            starts_at: form.starts_at || null,
            expires_at: form.expires_at || null,
            applies_to: form.applies_to,
            is_active: form.is_active,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to create coupon");
          setSaving(false);
          return;
        }
      }

      closeModal();
      fetchCoupons();
    } catch (err) {
      toast.error("Failed to save coupon: " + err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (coupon) => {
    try {
      const res = await fetch(`/api/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      if (res.ok) {
        fetchCoupons();
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/coupons/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirmId(null);
        fetchCoupons();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete coupon");
      }
    } catch (err) {
      toast.error("Failed to delete coupon: " + err.message);
    }
  };

  // Stats
  const activeCount = coupons.filter((c) => c.is_active && !isExpired(c) && !isExhausted(c)).length;
  const totalUsed = coupons.reduce((s, c) => s + (c.used_count || 0), 0);
  const expiredCount = coupons.filter((c) => isExpired(c)).length;

  return (
    <>
      <div className="page-header">
        <h1>Coupons</h1>
        <div className="page-header-actions">
          {limitReached ? (
            <button className="btn btn-primary" onClick={() => router.push('/dashboard/billing')} style={{ opacity: 0.7 }}>
              Upgrade for More Coupons
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Create Coupon
            </button>
          )}
        </div>
      </div>

      {/* Plan limit indicator */}
      {couponLimit !== -1 && (
        <div style={{
          padding: "var(--space-sm) var(--space-lg)",
          marginBottom: "var(--space-lg)",
          borderRadius: "var(--radius-md)",
          background: "rgba(108, 92, 231, 0.08)",
          border: "1px solid rgba(108, 92, 231, 0.15)",
          fontSize: "var(--font-size-sm)",
          color: "var(--accent-primary-light)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
        }}>
          <Tag size={14} />
          {coupons.length} / {couponLimit} coupons used ({accountPlan.charAt(0).toUpperCase() + accountPlan.slice(1)} plan)
          {limitReached && (
            <button
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--accent-primary-light)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
              onClick={() => router.push('/dashboard/billing')}
            >
              Upgrade
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Total Coupons", value: coupons.length, icon: <Tag size={18} />, color: "purple" },
          { label: "Active", value: activeCount, icon: <Check size={18} />, color: "green" },
          { label: "Total Redemptions", value: totalUsed, icon: <Gift size={18} />, color: "blue" },
          { label: "Expired", value: expiredCount, icon: <Clock size={18} />, color: "orange" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
            </div>
            <div className="stat-card-value" style={{ fontSize: "var(--font-size-2xl)" }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {["all", "active", "expired", "exhausted", "inactive"].map((f) => (
            <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <Search size={14} />
          <input type="text" placeholder="Search coupon code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Coupon list */}
      {loading ? (
        <PageSkeleton showStats={false} showTable={false} />
      ) : filteredCoupons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Tag size={32} /></div>
          <h3>No coupons found</h3>
          <p>{filter === "all" ? "Create your first coupon to offer discounts to your customers." : `No ${filter} coupons found.`}</p>
          {filter === "all" && !limitReached && (
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Create Coupon
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const typeConfig = TYPE_CONFIG[coupon.type];

            return (
              <div key={coupon.id} className="dashboard-panel" style={{ overflow: "visible" }}>
                <div style={{ padding: "var(--space-xl)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-md)" }}>
                  {/* Left: Coupon info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)", flexWrap: "wrap" }}>
                      {/* Code (monospace, copyable) */}
                      <button
                        onClick={() => handleCopyCode(coupon.code, coupon.id)}
                        style={{
                          fontFamily: "monospace", fontSize: "var(--font-size-lg)", fontWeight: 800,
                          background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)", padding: "4px 12px", color: "var(--text-primary)",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                          letterSpacing: "0.05em",
                        }}
                        title="Click to copy"
                      >
                        {coupon.code}
                        {copiedId === coupon.id ? <Check size={14} style={{ color: "var(--accent-green)" }} /> : <Copy size={14} style={{ color: "var(--text-tertiary)" }} />}
                      </button>

                      {/* Type badge */}
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: typeConfig.bg, color: typeConfig.color,
                        border: `1px solid ${typeConfig.color}33`,
                      }}>
                        {typeConfig.icon} {typeConfig.label}
                      </span>

                      {/* Status badge */}
                      <span style={{
                        padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: `${status.color}15`, color: status.color,
                        border: `1px solid ${status.color}33`,
                      }}>
                        {status.label}
                      </span>
                    </div>

                    {/* Value and details */}
                    <div style={{ display: "flex", gap: "var(--space-xl)", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "var(--font-size-base)" }}>
                        {formatValue(coupon)} OFF
                      </span>
                      {coupon.min_order_value > 0 && (
                        <span>Min. order: {parseFloat(coupon.min_order_value).toFixed(2)} EGP</span>
                      )}
                      <span>
                        {coupon.used_count || 0}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""} used
                      </span>
                      <span>{APPLIES_TO_LABELS[coupon.applies_to] || coupon.applies_to}</span>
                    </div>

                    {/* Dates */}
                    <div style={{ display: "flex", gap: "var(--space-xl)", fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-xs)", flexWrap: "wrap" }}>
                      <span><Calendar size={12} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />Starts: {formatDate(coupon.starts_at)}</span>
                      {coupon.expires_at && (
                        <span><Clock size={12} style={{ display: "inline", verticalAlign: -1, marginRight: 4 }} />Expires: {formatDate(coupon.expires_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
                    {/* Toggle active */}
                    <button
                      className="topbar-btn"
                      title={coupon.is_active ? "Deactivate" : "Activate"}
                      onClick={() => handleToggleActive(coupon)}
                      style={{ color: coupon.is_active ? "var(--accent-green)" : "var(--text-tertiary)" }}
                    >
                      {coupon.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    {/* Edit */}
                    <button className="topbar-btn" title="Edit" onClick={() => openEditModal(coupon)}>
                      <Edit size={16} />
                    </button>

                    {/* Delete */}
                    {deleteConfirmId === coupon.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--accent-red)", fontWeight: 600 }}>Delete?</span>
                        <button
                          className="topbar-btn"
                          style={{ color: "var(--accent-red)" }}
                          onClick={() => handleDelete(coupon.id)}
                        >
                          <Check size={16} />
                        </button>
                        <button className="topbar-btn" onClick={() => setDeleteConfirmId(null)}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button className="topbar-btn" title="Delete" onClick={() => setDeleteConfirmId(coupon.id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</h3>
              <button className="modal-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {/* Code */}
                <div className="form-group">
                  <label className="form-label">Coupon Code</label>
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SUMMER2025"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      style={{ fontFamily: "monospace", letterSpacing: "0.05em", flex: 1 }}
                      required
                    />
                    {!editingCoupon && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setForm({ ...form, code: generateCouponCode() })}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <RefreshCw size={12} /> Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="form-group">
                  <label className="form-label">Discount Type</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-sm)" }}>
                    {[
                      { value: "percentage", label: "Percentage", icon: <Percent size={16} /> },
                      { value: "fixed", label: "Fixed Amount", icon: <DollarSign size={16} /> },
                      { value: "free_shipping", label: "Free Shipping", icon: <Truck size={16} /> },
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.value, value: t.value === "free_shipping" ? "0" : form.value })}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          padding: "var(--space-md)", borderRadius: "var(--radius-md)",
                          border: `1px solid ${form.type === t.value ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                          background: form.type === t.value ? "rgba(108, 92, 231, 0.1)" : "var(--bg-glass)",
                          color: form.type === t.value ? "var(--accent-primary-light)" : "var(--text-secondary)",
                          cursor: "pointer", transition: "all 0.15s ease",
                          fontSize: "var(--font-size-sm)", fontWeight: 600,
                        }}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value */}
                {form.type !== "free_shipping" && (
                  <div className="form-group">
                    <label className="form-label">
                      {form.type === "percentage" ? "Discount Percentage" : "Discount Amount (EGP)"}
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder={form.type === "percentage" ? "e.g. 25" : "e.g. 50.00"}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      min="0"
                      max={form.type === "percentage" ? "100" : undefined}
                      step={form.type === "percentage" ? "1" : "0.01"}
                      required
                    />
                    {form.type === "percentage" && Number(form.value) > 100 && (
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-red)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={12} /> Percentage cannot exceed 100%
                      </p>
                    )}
                  </div>
                )}

                {/* Min order value + Max uses */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  <div className="form-group">
                    <label className="form-label">Min. Order Value (EGP)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={form.min_order_value}
                      onChange={(e) => setForm({ ...form, min_order_value: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>Leave empty for no minimum</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Uses</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Unlimited"
                      value={form.max_uses}
                      onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                      min="1"
                    />
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>Leave empty for unlimited</p>
                  </div>
                </div>

                {/* Date pickers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.starts_at}
                      onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                      min={form.starts_at || undefined}
                    />
                  </div>
                </div>

                {/* Applies to */}
                <div className="form-group">
                  <label className="form-label">Applies To</label>
                  <select
                    className="form-input"
                    value={form.applies_to}
                    onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
                  >
                    <option value="all">All Products</option>
                    <option value="specific_products">Specific Products</option>
                    <option value="specific_categories">Specific Categories</option>
                  </select>
                </div>

                {/* Active toggle */}
                <div className="form-group" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Active</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
                      cursor: "pointer", color: form.is_active ? "var(--accent-green)" : "var(--text-tertiary)",
                      fontSize: "var(--font-size-sm)", fontWeight: 600,
                    }}
                  >
                    {form.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    {form.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.code.trim() || (form.type !== "free_shipping" && !form.value) || (form.type === "percentage" && Number(form.value) > 100)}
                >
                  {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : (
                    editingCoupon ? "Save Changes" : <><Plus size={14} /> Create Coupon</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
