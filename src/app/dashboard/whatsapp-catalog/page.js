"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone, RefreshCw, CheckCircle, XCircle, Loader2,
  Package, Upload, Trash2, ToggleLeft, ToggleRight, Eye,
  AlertCircle, ExternalLink, Settings, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function WhatsAppCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [catalogStatus, setCatalogStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncingProduct, setSyncingProduct] = useState(null);
  const [autoSync, setAutoSync] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [catalogId, setCatalogId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch catalog status
      const statusRes = await fetch("/api/whatsapp/catalog");
      const statusData = await statusRes.json();
      setCatalogStatus(statusData);
      setAutoSync(statusData.syncEnabled || false);
      setCatalogId(statusData.catalogId || "");

      // Fetch products
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("products")
          .select("id, name, price, category, image_url, status")
          .eq("account_id", user.id)
          .order("name");
        setProducts(data || []);
      }
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/whatsapp/catalog", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`Sync complete! ${data.synced} products synced, ${data.failed} failed.`);
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
      fetchData();
    } catch (err) {
      alert("Sync error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCatalog = async () => {
    if (!confirm("Are you sure you want to remove all products from your WhatsApp catalog?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/whatsapp/catalog", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert(`Cleared ${data.deleted} products from WhatsApp catalog.`);
      } else {
        alert("Clear failed: " + (data.error || "Unknown error"));
      }
      fetchData();
    } catch (err) {
      alert("Clear error: " + err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleSyncProduct = async (productId) => {
    setSyncingProduct(productId);
    try {
      const res = await fetch(`/api/whatsapp/catalog/${productId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Product synced to WhatsApp catalog!");
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Sync error: " + err.message);
    } finally {
      setSyncingProduct(null);
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      const res = await fetch(`/api/whatsapp/catalog/${productId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("Product removed from WhatsApp catalog.");
      } else {
        alert("Remove failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Remove error: " + err.message);
    }
  };

  const handleToggleAutoSync = async () => {
    const newVal = !autoSync;
    setAutoSync(newVal);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("accounts")
          .update({ whatsapp_catalog_sync_enabled: newVal })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("Toggle auto sync error:", err);
      setAutoSync(!newVal);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("accounts")
          .update({
            whatsapp_catalog_id: catalogId || null,
            whatsapp_access_token: whatsappToken || null,
          })
          .eq("id", user.id);
        setShowSettings(false);
        fetchData();
      }
    } catch (err) {
      console.error("Save settings error:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  const isConnected = catalogStatus?.connected;

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Smartphone size={28} style={{ color: "#25D366" }} />
          WA Catalog
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            <Settings size={16} /> Settings
          </button>
          {isConnected && (
            <button
              className="btn btn-primary"
              onClick={handleSyncAll}
              disabled={syncing}
            >
              {syncing ? <><Loader2 size={16} className="spin" /> Syncing...</> : <><Upload size={16} /> Sync All Products</>}
            </button>
          )}
        </div>
      </div>

      {/* Connection Status Card */}
      <div className="wa-catalog-status-card">
        <div className="wa-catalog-status-row">
          <div className="wa-catalog-status-indicator">
            {isConnected ? (
              <CheckCircle size={24} style={{ color: "var(--accent-green)" }} />
            ) : (
              <XCircle size={24} style={{ color: "var(--accent-red)" }} />
            )}
          </div>
          <div className="wa-catalog-status-info">
            <div className="wa-catalog-status-label">
              WhatsApp Business API
            </div>
            <div className="wa-catalog-status-value">
              {isConnected ? "Connected" : "Not Connected"}
            </div>
            {catalogStatus?.catalogId && (
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                Catalog ID: {catalogStatus.catalogId}
              </div>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="wa-catalog-stats-row">
            <div className="wa-catalog-stat">
              <span className="wa-catalog-stat-value">{catalogStatus?.localProductCount || 0}</span>
              <span className="wa-catalog-stat-label">Local Products</span>
            </div>
            <div className="wa-catalog-stat">
              <span className="wa-catalog-stat-value">{catalogStatus?.catalogProductCount || 0}</span>
              <span className="wa-catalog-stat-label">Synced to WA</span>
            </div>
            <div className="wa-catalog-stat">
              <span className="wa-catalog-stat-value">
                {catalogStatus?.lastSync
                  ? new Date(catalogStatus.lastSync).toLocaleString()
                  : "Never"}
              </span>
              <span className="wa-catalog-stat-label">Last Sync</span>
            </div>
          </div>
        )}
      </div>

      {isConnected ? (
        <>
          {/* Auto-Sync Toggle & Clear */}
          <div className="wa-catalog-controls">
            <div className="wa-catalog-auto-sync">
              <div className="wa-catalog-auto-sync-info">
                <span className="wa-catalog-auto-sync-label">Auto-sync Products</span>
                <span className="wa-catalog-auto-sync-desc">
                  Automatically sync new/updated products to WhatsApp catalog
                </span>
              </div>
              <div
                onClick={handleToggleAutoSync}
                style={{ color: autoSync ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
              >
                {autoSync ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleClearCatalog}
              disabled={clearing}
            >
              {clearing ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Clear Catalog
            </button>
          </div>

          {/* Product List */}
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={18} style={{ color: "var(--accent-primary-light)" }} />
                Products
              </h3>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                {products.length} total
              </span>
            </div>
            <div className="wa-catalog-products-list">
              {products.length === 0 ? (
                <div className="empty-state" style={{ padding: "var(--space-2xl)" }}>
                  <Package size={32} style={{ color: "var(--text-tertiary)", marginBottom: 8 }} />
                  <h3 style={{ fontSize: "var(--font-size-base)" }}>No Products</h3>
                  <p style={{ fontSize: "var(--font-size-sm)" }}>Add products first, then sync them to WhatsApp.</p>
                </div>
              ) : (
                products.map((product) => (
                  <div key={product.id} className="wa-catalog-product-row">
                    <div className="wa-catalog-product-image">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} />
                      ) : (
                        <Package size={20} style={{ color: "var(--text-tertiary)" }} />
                      )}
                    </div>
                    <div className="wa-catalog-product-info">
                      <div className="wa-catalog-product-name">{product.name}</div>
                      <div className="wa-catalog-product-meta">
                        <span>EGP {product.price}</span>
                        {product.category && <span>{product.category}</span>}
                      </div>
                    </div>
                    <div className="wa-catalog-product-status">
                      {product.status === "active" ? (
                        <span className="status-badge active">Active</span>
                      ) : (
                        <span className="status-badge draft">Draft</span>
                      )}
                    </div>
                    <div className="wa-catalog-product-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSyncProduct(product.id)}
                        disabled={syncingProduct === product.id}
                        title="Sync to WhatsApp"
                      >
                        {syncingProduct === product.id ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRemoveProduct(product.id)}
                        title="Remove from WhatsApp"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Catalog Preview */}
          <div className="dashboard-panel" style={{ marginTop: "var(--space-xl)" }}>
            <div className="dashboard-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={18} style={{ color: "var(--accent-secondary)" }} />
                Catalog Preview
              </h3>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                How products appear in WhatsApp
              </span>
            </div>
            <div className="wa-catalog-preview">
              <div className="wa-catalog-preview-phone">
                <div className="wa-catalog-preview-header">
                  <Smartphone size={16} />
                  <span>WhatsApp Business</span>
                </div>
                <div className="wa-catalog-preview-body">
                  {products.filter((p) => p.status === "active").slice(0, 4).map((product) => (
                    <div key={product.id} className="wa-catalog-preview-item">
                      <div className="wa-catalog-preview-item-image">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} />
                        ) : (
                          <Package size={20} style={{ color: "var(--text-tertiary)" }} />
                        )}
                      </div>
                      <div className="wa-catalog-preview-item-info">
                        <div className="wa-catalog-preview-item-name">{product.name}</div>
                        <div className="wa-catalog-preview-item-price">EGP {product.price}</div>
                        {product.description && (
                          <div className="wa-catalog-preview-item-desc">{product.description.slice(0, 60)}...</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {products.filter((p) => p.status === "active").length > 4 && (
                    <div className="wa-catalog-preview-more">
                      +{products.filter((p) => p.status === "active").length - 4} more products
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Not Connected State */
        <div className="wa-catalog-setup">
          <div className="wa-catalog-setup-card">
            <div className="wa-catalog-setup-icon">
              <Smartphone size={40} />
            </div>
            <h3>Connect WhatsApp Business API</h3>
            <p>
              To sync your products to WhatsApp&apos;s native catalog, you need to connect your
              WhatsApp Business API account with a Meta access token and catalog ID.
            </p>
            <div className="wa-catalog-setup-steps">
              <div className="wa-catalog-setup-step">
                <span className="wa-catalog-setup-step-num">1</span>
                <span>Go to Meta Business Suite and create a Commerce catalog</span>
              </div>
              <div className="wa-catalog-setup-step">
                <span className="wa-catalog-setup-step-num">2</span>
                <span>Generate a System User access token with catalog permissions</span>
              </div>
              <div className="wa-catalog-setup-step">
                <span className="wa-catalog-setup-step-num">3</span>
                <span>Copy your Catalog ID from Commerce Manager</span>
              </div>
              <div className="wa-catalog-setup-step">
                <span className="wa-catalog-setup-step-num">4</span>
                <span>Enter both in Settings below</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowSettings(true)}>
              <Settings size={16} /> Configure WhatsApp Catalog
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Smartphone size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />WhatsApp Catalog Settings</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}><X size={18} style={{ display: "inline" }} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Catalog ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                  placeholder="e.g., 123456789012345"
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Find this in Meta Commerce Manager under your catalog settings
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Access Token</label>
                <input
                  type="password"
                  className="form-input"
                  value={whatsappToken}
                  onChange={(e) => setWhatsappToken(e.target.value)}
                  placeholder="Your Meta System User access token"
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Requires <code>catalog_management</code> permission on your access token
                </p>
              </div>
              <div className="wa-catalog-settings-info">
                <AlertCircle size={16} style={{ flexShrink: 0, color: "var(--accent-orange)" }} />
                <span>
                  Your access token is stored securely and used only for syncing products
                  to your WhatsApp catalog. It is never shared with third parties.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? <><Loader2 size={16} className="spin" /> Saving...</> : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
