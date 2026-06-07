"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Settings,
  RefreshCw,
  Plus,
  Search,
  Eye,
  ExternalLink,
  Key,
  X,
  Loader2,
  ChevronDown,
  EyeOff,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentStore } from "@/lib/store-context";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "gray", icon: Clock },
  info_received: { label: "Info Received", color: "blue", icon: Package },
  in_transit: { label: "In Transit", color: "blue", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "amber", icon: Truck },
  delivered: { label: "Delivered", color: "green", icon: CheckCircle },
  failed_attempt: { label: "Failed Attempt", color: "amber", icon: AlertCircle },
  exception: { label: "Exception", color: "red", icon: AlertCircle },
  expired: { label: "Expired", color: "gray", icon: Clock },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "exception", label: "Exception" },
];

// Demo shipments for demo mode
const DEMO_SHIPMENTS = [
  {
    id: "demo-1",
    tracking_number: "ARA-2026-8743210",
    carrier: "Aramex",
    carrier_code: "aramex",
    status: "in_transit",
    title: "ORD-2026-0042",
    order_id: null,
    estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: new Date().toISOString(),
    auto_track: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    checkpoints: [
      {
        location: "Cairo, Egypt",
        message: "Delivered - signed by recipient",
        tag: "delivered",
        checkpoint_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Alexandria, Egypt",
        message: "In transit - departed sorting facility",
        tag: "in_transit",
        checkpoint_time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Cairo, Egypt",
        message: "Package picked up by carrier",
        tag: "info_received",
        checkpoint_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Cairo, Egypt",
        message: "Shipment information received",
        tag: "pending",
        checkpoint_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "demo-2",
    tracking_number: "DHL-9284-7361",
    carrier: "DHL Express",
    carrier_code: "dhl",
    status: "out_for_delivery",
    title: "ORD-2026-0055",
    order_id: null,
    estimated_delivery: new Date(Date.now() + 0.5 * 24 * 60 * 60 * 1000).toISOString(),
    last_checked_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    auto_track: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    checkpoints: [
      {
        location: "Dubai, UAE",
        message: "Out for delivery - with local courier",
        tag: "out_for_delivery",
        checkpoint_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Dubai, UAE",
        message: "Arrived at delivery center",
        tag: "in_transit",
        checkpoint_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Frankfurt, Germany",
        message: "In transit - departed hub",
        tag: "in_transit",
        checkpoint_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "London, UK",
        message: "Package picked up",
        tag: "info_received",
        checkpoint_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "demo-3",
    tracking_number: "FDX-4820-9917-3356",
    carrier: "FedEx",
    carrier_code: "fedex",
    status: "delivered",
    title: "ORD-2026-0038",
    order_id: null,
    estimated_delivery: null,
    last_checked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    auto_track: true,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    checkpoints: [
      {
        location: "New York, USA",
        message: "Delivered - left at front door",
        tag: "delivered",
        checkpoint_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "New York, USA",
        message: "Out for delivery",
        tag: "out_for_delivery",
        checkpoint_time: new Date(Date.now() - 2.2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Memphis, USA",
        message: "In transit - departed hub",
        tag: "in_transit",
        checkpoint_time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Singapore",
        message: "Package picked up",
        tag: "info_received",
        checkpoint_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: "demo-4",
    tracking_number: "UPS-1Z999AA10",
    carrier: "UPS",
    carrier_code: "ups",
    status: "exception",
    title: "ORD-2026-0061",
    order_id: null,
    estimated_delivery: null,
    last_checked_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    auto_track: true,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    checkpoints: [
      {
        location: "Istanbul, Turkey",
        message: "Exception - delivery attempt failed, recipient not available",
        tag: "exception",
        checkpoint_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Istanbul, Turkey",
        message: "Out for delivery",
        tag: "out_for_delivery",
        checkpoint_time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      },
      {
        location: "Istanbul, Turkey",
        message: "Arrived at local facility",
        tag: "in_transit",
        checkpoint_time: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export default function ShippingPage() {
  
  const confirmAction = useConfirm();
  const [shipments, setShipments] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [config, setConfig] = useState({ api_key: "", api_key_set: false, default_carrier: "aramex", auto_track: true, connected: false });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(null);
  const [sendingUpdate, setSendingUpdate] = useState(null);

  // Config panel state
  const [showApiKey, setShowApiKey] = useState(false);
  const [configForm, setConfigForm] = useState({ api_key: "", default_carrier: "aramex", auto_track: true });
  const [savingConfig, setSavingConfig] = useState(false);

  // Add tracking modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ order_id: "", tracking_number: "", carrier: "aramex", title: "" });
  const [addingTracking, setAddingTracking] = useState(false);
  const [orders, setOrders] = useState([]);

  // Timeline panel state
  const [viewingShipment, setViewingShipment] = useState(null);

  // Demo mode
  const [isDemo, setIsDemo] = useState(false);

  const supabase = createClient();
  const { currentStoreId } = useCurrentStore();
  const toast = useToast();

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/shipping/config");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConfig(data.config);
          setConfigForm({
            api_key: "",
            default_carrier: data.config.default_carrier || "aramex",
            auto_track: data.config.auto_track !== false,
          });
          setIsDemo(!data.config.connected);
        }
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    }
  }, []);

  // Fetch carriers
  const fetchCarriers = useCallback(async () => {
    try {
      const res = await fetch("/api/shipping/carriers");
      if (res.ok) {
        const data = await res.json();
        if (data.success) setCarriers(data.carriers || []);
      }
    } catch (err) {
      console.error("Failed to fetch carriers:", err);
    }
  }, []);

  // Fetch shipments
  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shipment_trackings")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setShipments(data);
        // If no shipments and no API key, use demo data
        if (data.length === 0 && !config.connected) {
          setIsDemo(true);
          setShipments(DEMO_SHIPMENTS);
        }
      } else if (!config.connected) {
        setIsDemo(true);
        setShipments(DEMO_SHIPMENTS);
      }
    } catch (err) {
      if (!config.connected) {
        setIsDemo(true);
        setShipments(DEMO_SHIPMENTS);
      }
    }
    setLoading(false);
  }, [config.connected, currentStoreId]);

  // Fetch orders for dropdown
  const fetchOrders = useCallback(async () => {
    try {
      let query = supabase
        .from("orders")
        .select("id, order_number, status")
        .order("created_at", { ascending: false })
        .limit(20);
      if (currentStoreId) query = query.eq("store_id", currentStoreId);
      const { data } = await query;
      setOrders(data || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  }, [currentStoreId]);

  useEffect(() => { fetchConfig(); fetchCarriers(); }, []);
  useEffect(() => { fetchShipments(); }, [fetchShipments]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Save config
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const payload = {
        default_carrier: configForm.default_carrier,
        auto_track: configForm.auto_track,
      };
      // Only send API key if user entered one
      if (configForm.api_key.trim()) {
        payload.api_key = configForm.api_key.trim();
      }
      const res = await fetch("/api/shipping/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        await fetchConfig();
        await fetchShipments();
        setConfigForm((prev) => ({ ...prev, api_key: "" }));
      } else {
        toast.error("Failed to save config: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    }
    setSavingConfig(false);
  };

  // Add tracking
  const handleAddTracking = async () => {
    if (!addForm.tracking_number.trim()) {
      toast.warning("Tracking number is required");
      return;
    }
    setAddingTracking(true);
    try {
      const res = await fetch("/api/shipping/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setAddForm({ order_id: "", tracking_number: "", carrier: "aramex", title: "" });
        await fetchShipments();
      } else {
        toast.error("Failed to add tracking: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    }
    setAddingTracking(false);
  };

  // Refresh tracking
  const handleRefresh = async (shipment) => {
    if (shipment.id?.startsWith("demo-")) {
      // Simulate refresh for demo
      setRefreshing(shipment.id);
      setTimeout(() => setRefreshing(null), 1000);
      return;
    }
    setRefreshing(shipment.id);
    try {
      const res = await fetch("/api/shipping/track", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shipment.id }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchShipments();
        // Update viewing shipment if it's the same
        if (viewingShipment?.id === shipment.id) {
          setViewingShipment(data.tracking);
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
    }
    setRefreshing(null);
  };

  // Send update to customer
  const handleSendUpdate = async (shipment) => {
    setSendingUpdate(shipment.id);
    try {
      const statusInfo = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending;
      const message = `📦 Shipment Update\n\nTracking: ${shipment.tracking_number}\nCarrier: ${shipment.carrier}\nStatus: ${statusInfo.label}\n${shipment.estimated_delivery ? "Est. Delivery: " + formatDate(shipment.estimated_delivery) : ""}`;

      // Find the order's customer conversation
      if (shipment.order_id) {
        const { data: order } = await supabase
          .from("orders")
          .select("customer_id, order_number")
          .eq("id", shipment.order_id)
          .single();

        if (order?.customer_id) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("customer_id", order.customer_id)
            .eq("account_id", (await supabase.auth.getUser()).data.user?.id)
            .limit(1)
            .single();

          if (conv) {
            await fetch("/api/messages/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: conv.id,
                content: message,
                type: "text",
              }),
            });
            toast.success("Shipping update sent to customer!");
          } else {
            toast.warning("No conversation found for this order's customer.");
          }
        } else {
          toast.warning("No customer associated with this order.");
        }
      } else {
        toast.warning("This tracking is not linked to an order with a customer.");
      }
    } catch (err) {
      toast.error("Error sending update: " + err.message);
    }
    setSendingUpdate(null);
  };

  // Delete tracking
  const handleDelete = async (shipment) => {
    if (!(await confirmAction("Delete this tracking record?"))) return;
    if (shipment.id?.startsWith("demo-")) return;
    try {
      await fetch(`/api/shipping/track?id=${shipment.id}`, { method: "DELETE" });
      await fetchShipments();
      if (viewingShipment?.id === shipment.id) setViewingShipment(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Format helpers
  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatTimeAgo = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Filtered shipments
  const filteredShipments = shipments.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.tracking_number?.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q) ||
        s.order_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: shipments.length,
    in_transit: shipments.filter((s) => s.status === "in_transit").length,
    delivered: shipments.filter((s) => s.status === "delivered").length,
    exception: shipments.filter((s) => s.status === "exception").length,
  };

  return (
    <>
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="shipping-demo-banner">
          <div className="shipping-demo-banner-content">
            <Info size={16} />
            <span>
              Running in <strong>demo mode</strong>. Connect AfterShip for live tracking data.
            </span>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: "rgba(0, 210, 255, 0.15)", color: "var(--accent-secondary)", border: "1px solid rgba(0, 210, 255, 0.3)" }}
            onClick={() => document.getElementById("shipping-config-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            Connect Now
          </button>
        </div>
      )}

      <div className="page-header">
        <h1>Shipping</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Tracking
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple"><Truck size={20} /></div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total Shipments</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue"><Package size={20} /></div>
          </div>
          <div className="stat-card-value">{stats.in_transit}</div>
          <div className="stat-card-label">In Transit</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green"><CheckCircle size={20} /></div>
          </div>
          <div className="stat-card-value">{stats.delivered}</div>
          <div className="stat-card-label">Delivered</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange"><AlertCircle size={20} /></div>
          </div>
          <div className="stat-card-value">{stats.exception}</div>
          <div className="stat-card-label">Exceptions</div>
        </div>
      </div>

      {/* Integration Setup */}
      <div className="dashboard-panel" id="shipping-config-section" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Settings size={18} />
            AfterShip Integration
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`shipping-connection-badge ${config.connected ? "connected" : "disconnected"}`}>
              <span className="shipping-connection-dot"></span>
              {config.connected ? "Connected" : "Not Connected"}
            </span>
          </div>
        </div>
        <div className="dashboard-panel-body">
          <div className="shipping-config-grid">
            <div className="shipping-config-form">
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Key size={14} />
                  AfterShip API Key
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showApiKey ? "text" : "password"}
                    className="form-input"
                    placeholder={config.api_key_set ? "•••••••••••••••• (enter new to change)" : "Enter your AfterShip API key"}
                    value={configForm.api_key}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, api_key: e.target.value }))}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer",
                    }}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Carrier</label>
                <select
                  className="form-input"
                  value={configForm.default_carrier}
                  onChange={(e) => setConfigForm((prev) => ({ ...prev, default_carrier: e.target.value }))}
                >
                  {carriers.length > 0 ? (
                    carriers.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))
                  ) : (
                    <option value="aramex">Aramex</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Auto-track Shipments
                  <button
                    className={`shipping-toggle ${configForm.auto_track ? "active" : ""}`}
                    onClick={() => setConfigForm((prev) => ({ ...prev, auto_track: !prev.auto_track }))}
                    type="button"
                  >
                    <span className="shipping-toggle-thumb"></span>
                  </button>
                </label>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Automatically track new shipments when orders are created
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                style={{ marginTop: "var(--space-sm)" }}
              >
                {savingConfig ? <Loader2 size={16} className="spin" /> : <Settings size={16} />}
                Save Config
              </button>
            </div>

            <div className="shipping-config-info">
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-md)", fontWeight: 600 }}>
                How to Get an AfterShip API Key
              </div>
              <ol style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 2, paddingLeft: 20 }}>
                <li>Visit <a href="https://www.aftership.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary-light)", textDecoration: "underline" }}>aftership.com</a> and create a free account</li>
                <li>Navigate to Settings &rarr; API Keys</li>
                <li>Generate a new API key (Live or Test mode)</li>
                <li>Copy the key and paste it above</li>
                <li>Click &ldquo;Save Config&rdquo; to connect</li>
              </ol>
              <div style={{ marginTop: "var(--space-lg)", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 600 }}>FREE TIER</div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                  AfterShip free plan includes 100 tracking/month. No credit card required.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Shipments */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.key !== "all" && stats[tab.key] > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, background: "var(--bg-glass)", padding: "1px 6px", borderRadius: 10 }}>
                  {stats[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search tracking # or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
              <Loader2 size={24} className="spin" style={{ marginBottom: "var(--space-sm)" }} />
              <div>Loading shipments...</div>
            </div>
          ) : (
            <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Tracking Number</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Last Update</th>
                  <th>Est. Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((shipment) => {
                  const statusConf = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={shipment.id}>
                      <td style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>
                        {shipment.title || "—"}
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "var(--font-size-xs)" }}>
                          {shipment.tracking_number}
                        </span>
                      </td>
                      <td>
                        <span className="carrier-badge">
                          <Truck size={12} />
                          {shipment.carrier}
                        </span>
                      </td>
                      <td>
                        <span className={`shipping-status-badge ${statusConf.color}`}>
                          <StatusIcon size={12} />
                          {statusConf.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                        {formatTimeAgo(shipment.last_checked_at || shipment.updated_at)}
                      </td>
                      <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                        {shipment.estimated_delivery ? formatDate(shipment.estimated_delivery) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="topbar-btn"
                            style={{ width: 30, height: 30 }}
                            title="View Timeline"
                            onClick={() => setViewingShipment(shipment)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="topbar-btn"
                            style={{ width: 30, height: 30 }}
                            title="Refresh"
                            onClick={() => handleRefresh(shipment)}
                            disabled={refreshing === shipment.id}
                          >
                            {refreshing === shipment.id ? (
                              <Loader2 size={14} className="spin" />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                          </button>
                          <button
                            className="topbar-btn"
                            style={{ width: 30, height: 30 }}
                            title="Send Update to Customer"
                            onClick={() => handleSendUpdate(shipment)}
                            disabled={sendingUpdate === shipment.id}
                          >
                            {sendingUpdate === shipment.id ? (
                              <Loader2 size={14} className="spin" />
                            ) : (
                              <Send size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredShipments.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)" }}>
                      No shipments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Tracking Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Add Tracking</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Order (optional)</label>
                <select
                  className="form-input"
                  value={addForm.order_id}
                  onChange={(e) => {
                    const selectedOrder = orders.find((o) => o.id === e.target.value);
                    setAddForm((prev) => ({
                      ...prev,
                      order_id: e.target.value,
                      title: selectedOrder?.order_number || prev.title,
                    }));
                  }}
                >
                  <option value="">Select an order...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tracking Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ARA-2026-8743210"
                  value={addForm.tracking_number}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, tracking_number: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Carrier</label>
                <select
                  className="form-input"
                  value={addForm.carrier}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, carrier: e.target.value }))}
                >
                  {carriers.length > 0 ? (
                    carriers.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="aramex">Aramex</option>
                      <option value="dhl">DHL Express</option>
                      <option value="fedex">FedEx</option>
                      <option value="ups">UPS</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Title (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Order #ORD-2026-0042"
                  value={addForm.title}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddTracking} disabled={addingTracking || !addForm.tracking_number.trim()}>
                {addingTracking ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                Add Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Timeline Panel */}
      {viewingShipment && (
        <div className="shipping-panel-overlay" onClick={(e) => e.target === e.currentTarget && setViewingShipment(null)}>
          <div className="shipping-panel">
            <div className="shipping-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={18} />
                Tracking Timeline
              </h3>
              <button className="modal-close" onClick={() => setViewingShipment(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="shipping-panel-body">
              {/* Shipment Summary */}
              <div className="shipping-summary">
                <div className="shipping-summary-row">
                  <span className="shipping-summary-label">Tracking #</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{viewingShipment.tracking_number}</span>
                </div>
                <div className="shipping-summary-row">
                  <span className="shipping-summary-label">Carrier</span>
                  <span className="carrier-badge">
                    <Truck size={12} />
                    {viewingShipment.carrier}
                  </span>
                </div>
                <div className="shipping-summary-row">
                  <span className="shipping-summary-label">Status</span>
                  {(() => {
                    const sc = STATUS_CONFIG[viewingShipment.status] || STATUS_CONFIG.pending;
                    const ScIcon = sc.icon;
                    return (
                      <span className={`shipping-status-badge ${sc.color}`}>
                        <ScIcon size={12} />
                        {sc.label}
                      </span>
                    );
                  })()}
                </div>
                {viewingShipment.estimated_delivery && (
                  <div className="shipping-summary-row">
                    <span className="shipping-summary-label">Est. Delivery</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} style={{ color: "var(--accent-secondary)" }} />
                      {formatDate(viewingShipment.estimated_delivery)}
                    </span>
                  </div>
                )}
                {viewingShipment.title && (
                  <div className="shipping-summary-row">
                    <span className="shipping-summary-label">Order</span>
                    <span style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{viewingShipment.title}</span>
                  </div>
                )}
              </div>

              {/* Checkpoints Timeline */}
              <div style={{ marginTop: "var(--space-xl)" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-lg)", fontWeight: 600 }}>
                  Checkpoints
                </div>
                <div className="tracking-timeline">
                  {(viewingShipment.checkpoints || []).map((cp, idx) => {
                    const cpConf = STATUS_CONFIG[cp.tag] || STATUS_CONFIG.pending;
                    const CpIcon = cpConf.icon;
                    const isFirst = idx === 0;
                    return (
                      <div key={idx} className="tracking-checkpoint">
                        <div className={`tracking-checkpoint-dot ${cpConf.color} ${isFirst ? "latest" : ""}`}>
                          <CpIcon size={12} />
                        </div>
                        {idx < (viewingShipment.checkpoints || []).length - 1 && (
                          <div className="tracking-checkpoint-line"></div>
                        )}
                        <div className={`tracking-checkpoint-card ${isFirst ? "latest" : ""}`}>
                          <div className="tracking-checkpoint-message">{cp.message}</div>
                          <div className="tracking-checkpoint-meta">
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={10} />
                              {cp.location}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={10} />
                              {formatDateTime(cp.checkpoint_time)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: "var(--space-xl)", display: "flex", gap: "var(--space-md)" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleRefresh(viewingShipment)}
                  disabled={refreshing === viewingShipment.id}
                >
                  {refreshing === viewingShipment.id ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                  Refresh
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSendUpdate(viewingShipment)}
                  disabled={sendingUpdate === viewingShipment.id}
                >
                  {sendingUpdate === viewingShipment.id ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  Send Update to Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
