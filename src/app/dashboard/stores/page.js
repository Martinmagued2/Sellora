"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store, Plus, Pencil, Trash2, X, Loader2, CheckCircle,
  AlertCircle, Package, ShoppingBag, MessageCircle, Search,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCurrentStore } from "@/lib/store-context";

const INDUSTRIES = [
  "Fashion & Apparel", "Electronics", "Home & Garden", "Food & Beverage",
  "Health & Beauty", "Sports & Outdoors", "Toys & Games", "Books & Media",
  "Automotive", "Services", "Other",
];

const CURRENCIES = [
  { value: "EGP", label: "EGP - Egyptian Pound" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "GBP", label: "GBP - British Pound" },
];

const COUNTRIES = [
  "Egypt", "Saudi Arabia", "UAE", "Kuwait", "Jordan",
  "Morocco", "USA", "UK", "Germany", "France",
];

function generateSlug(name) {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function StoresPage() {
  const { stores, refreshStores, switchStore, currentStoreId } = useCurrentStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    logo_url: "",
    industry: "",
    currency: "EGP",
    country: "",
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStores = useCallback(async () => {
    setLoading(true);
    await refreshStores();
    setLoading(false);
  }, [refreshStores]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const openCreateModal = () => {
    setEditStore(null);
    setForm({ name: "", slug: "", description: "", logo_url: "", industry: "", currency: "EGP", country: "" });
    setShowModal(true);
  };

  const openEditModal = (store) => {
    setEditStore(store);
    setForm({
      name: store.name || "",
      slug: store.slug || "",
      description: store.description || "",
      logo_url: store.logo_url || "",
      industry: store.industry || "",
      currency: store.currency || "EGP",
      country: store.country || "",
    });
    setShowModal(true);
  };

  const handleNameChange = (name) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editStore ? prev.slug : generateSlug(name),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("Store name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editStore ? `/api/stores/${editStore.id}` : "/api/stores";
      const method = editStore ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(editStore ? "Store updated!" : "Store created!");
        setShowModal(false);
        fetchStores();
        // If new store, switch to it
        if (!editStore && data.store?.id) {
          switchStore(data.store.id);
        }
      } else {
        showToast(data.error || "Failed to save store", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    setSaving(false);
  };

  const handleDelete = async (storeId) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Store deleted!");
        setDeleteConfirm(null);
        fetchStores();
        // If deleted store was current, switch to first available
        if (storeId === currentStoreId && stores.length > 1) {
          const remaining = stores.filter((s) => s.id !== storeId);
          if (remaining.length > 0) switchStore(remaining[0].id);
        }
      } else {
        showToast(data.error || "Failed to delete store", "error");
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    }
    setDeleting(false);
  };

  const filteredStores = stores.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.industry || "").toLowerCase().includes(q);
  });

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed", top: 80, right: 24, zIndex: 300,
            padding: "12px 20px", borderRadius: 12,
            background: toast.type === "error" ? "rgba(255, 82, 82, 0.95)" : "rgba(0, 230, 118, 0.95)",
            color: "white", fontWeight: 600, fontSize: 13,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Store size={28} style={{ color: "var(--accent-primary-light)" }} />
          Stores
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add Store
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div className="filter-search" style={{ marginLeft: 0 }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Store Grid */}
      {loading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
          <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)", marginBottom: 12 }} />
          <div>Loading stores...</div>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Store size={36} /></div>
          <h3>No Stores Found</h3>
          <p>{search ? "No stores match your search." : "Create your first store to start managing products and orders."}</p>
          {!search && (
            <button className="btn btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Create Store
            </button>
          )}
        </div>
      ) : (
        <div className="products-grid">
          {filteredStores.map((store) => (
            <div key={store.id} className="product-card" style={{ cursor: "default" }}>
              {/* Store Header */}
              <div className="product-card-image" style={{ height: 80 }}>
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt={store.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "var(--accent-gradient)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 20,
                  }}>
                    {(store.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="product-card-status">
                  <span className={`status-badge ${store.is_active !== false ? "active" : "draft"}`}>
                    {store.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Store Body */}
              <div className="product-card-body">
                <div className="product-card-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {store.name}
                  {store.id === currentStoreId && (
                    <span style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 6,
                      background: "rgba(108, 92, 231, 0.15)", color: "var(--accent-primary-light)",
                      fontWeight: 700,
                    }}>
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="product-card-category">{store.industry || store.slug}</div>

                {/* Stats Row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4,
                  margin: "var(--space-sm) 0",
                }}>
                  <div style={{ textAlign: "center", padding: "6px 0", background: "var(--bg-glass)", borderRadius: 8 }}>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>{store.product_count || 0}</div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                      <Package size={9} style={{ display: "inline", verticalAlign: "middle" }} /> Products
                    </div>
                  </div>
                  <div style={{ textAlign: "center", padding: "6px 0", background: "var(--bg-glass)", borderRadius: 8 }}>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>{store.order_count || 0}</div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                      <ShoppingBag size={9} style={{ display: "inline", verticalAlign: "middle" }} /> Orders
                    </div>
                  </div>
                  <div style={{ textAlign: "center", padding: "6px 0", background: "var(--bg-glass)", borderRadius: 8 }}>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>{store.conversation_count || 0}</div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                      <MessageCircle size={9} style={{ display: "inline", verticalAlign: "middle" }} /> Chats
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="product-card-footer" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-sm)" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                    {store.currency || "EGP"} &middot; {store.country || "—"}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {store.id !== currentStoreId && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 10, padding: "2px 8px" }}
                        onClick={() => switchStore(store.id)}
                      >
                        Switch
                      </button>
                    )}
                    <button
                      className="topbar-btn"
                      style={{ width: 28, height: 28 }}
                      title="Edit"
                      onClick={() => openEditModal(store)}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="topbar-btn"
                      style={{ width: 28, height: 28, color: "var(--accent-red)" }}
                      title="Delete"
                      onClick={() => setDeleteConfirm(store)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Create/Edit Store Modal ═══ */}
      {showModal && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editStore ? "Edit Store" : "Create Store"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div className="form-group">
                <label className="form-label">Store Name *</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. My Fashion Store"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Slug</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="auto-generated-from-name"
                />
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                  URL-friendly identifier. Auto-generated from name.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input form-textarea"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your store..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.logo_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <select
                    className="form-input"
                    value={form.industry}
                    onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select
                    className="form-input"
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Country</label>
                <select
                  className="form-input"
                  value={form.country}
                  onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><CheckCircle size={16} /> {editStore ? "Save Changes" : "Create Store"}</>}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ═══ Delete Confirmation ═══ */}
      {deleteConfirm && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ color: "var(--accent-red)" }}>Delete Store</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", marginBottom: "var(--space-lg)" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(255, 82, 82, 0.1)", color: "var(--accent-red)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto var(--space-md)",
                }}>
                  <Trash2 size={24} />
                </div>
                <p style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>
                  Delete &ldquo;{deleteConfirm.name}&rdquo;?
                </p>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                  This will remove the store. Associated products, orders, and conversations will be
                  {stores.length > 1 ? " reassigned to another store" : " unlinked from any store"}.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={deleting}
                style={{ background: "var(--accent-red)", color: "white", border: "none" }}
              >
                {deleting ? <><Loader2 size={16} className="spin" /> Deleting...</> : <><Trash2 size={16} /> Delete Store</>}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
