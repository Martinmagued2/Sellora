"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag, Search, ChevronDown, Eye, X, Package, MapPin, CreditCard, StickyNote, Link2, Loader2, Truck, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentStore } from "@/lib/store-context";
import { useEffectiveAccount } from "@/lib/account-context";
import { useToast } from "../components/ToastProvider";
import { PageSkeleton } from "@/components/SkeletonLoader";
import StatusPipeline from "../components/StatusPipeline";
import EmptyState from "../components/EmptyState";

const statusColors = {
  pending: "pending", confirmed: "confirmed", shipped: "active",
  delivered: "delivered", cancelled: "cancelled", returned: "cancelled",
};

const channelLabels = {
  whatsapp: { emoji: "📱", label: "WhatsApp" },
  instagram: { emoji: "📸", label: "Instagram" },
  facebook: { emoji: "💬", label: "Facebook" },
  manual: { emoji: "✏️", label: "Manual" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(null); // order ID being generated
  const [sendingReview, setSendingReview] = useState(null); // order ID being sent review request

  const { currentStoreId } = useCurrentStore();
  const { effectiveAccountId } = useEffectiveAccount();
  const toast = useToast();

  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const accId = effectiveAccountId || user.id;
    let query = supabase
      .from("orders")
      .select("*, customer:customers(name, phone)")
      .eq("account_id", accId)
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("status", filter);
    if (search) query = query.ilike("order_number", `%${search}%`);
    if (currentStoreId) query = query.or(`store_id.eq.${currentStoreId},store_id.is.null`);

    const { data, error } = await query;
    if (!error) setOrders(data || []);
    setLoading(false);
  }, [filter, search, currentStoreId, effectiveAccountId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (id, newStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Route through the auto-update API so loyalty points + WhatsApp
    // notifications are triggered when the order is marked as "delivered".
    try {
      const res = await fetch("/api/orders/auto-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, newStatus }),
      });
      if (!res.ok) throw new Error("Auto-update failed");
      const data = await res.json();
      // Show a toast when loyalty points are awarded for a delivery
      if (newStatus === "delivered" && data?.loyalty?.awarded) {
        const pts = data.loyalty.points;
        const upgraded = data.loyalty.tierUpgraded;
        const newTier = data.loyalty.newTier;
        toast.success(
          `Order marked as delivered. +${pts} loyalty pts awarded!${
            upgraded && newTier ? ` 🎉 Customer upgraded to ${newTier} tier!` : ""
          }`
        );
      }
    } catch (e) {
      // Fallback to a direct update if the auto-update route fails
      await supabase.from("orders").update({ status: newStatus }).eq("id", id).eq("account_id", effectiveAccountId || user.id);
    }
    fetchOrders();
  };

  const generatePaymentLink = async (orderId) => {
    setGeneratingLink(orderId);
    try {
      const res = await fetch("/api/paymob/order-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();

      if (res.ok && data.paymentLink) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.paymentLink);
        toast.success("Payment link copied to clipboard!\n\n" + data.paymentLink);
        // Update the viewed order
        if (viewOrder?.id === orderId) {
          setViewOrder((prev) => ({ ...prev, payment_link: data.paymentLink, payment_method: "paymob" }));
        }
        fetchOrders();
      } else {
        toast.error("Failed to generate payment link: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    }
    setGeneratingLink(null);
  };

  const sendReviewRequest = async (orderId) => {
    setSendingReview(orderId);
    try {
      // Build the review URL — customer's first product in the order
      const APP_URL = window.location.origin;
      const firstItem = (viewOrder?.items || [])[0];
      const productId = firstItem?.product_id || firstItem?.id || "";
      const reviewUrl = `${APP_URL}/review?order=${orderId}&product=${productId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(reviewUrl);
      toast.success("Review link copied to clipboard!\n\nPaste it into your chat with the customer.");
    } catch (err) {
      toast.error("Failed to copy link: " + err.message);
    }
    setSendingReview(null);
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const getChannel = (ch) => channelLabels[ch] || channelLabels.manual;

  return (
    <>
      <div className="page-header">
        <h1>Orders</h1>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((f) => (
            <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-search">
          <Search size={14} />
          <input type="text" placeholder="Search by order #..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="dashboard-panel-body" style={{ padding: 0 }}>
          {loading ? (
            <PageSkeleton showStats={false} showTable={false} />
          ) : (
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Channel</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{order.order_number}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{order.customer?.name || "Unknown"}</div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{order.customer?.phone}</div>
                    </td>
                    <td>
                      {(order.items || []).map((item, i) => (
                        <div key={i} style={{ fontSize: "var(--font-size-xs)" }}>{item.qty}x {item.name}</div>
                      ))}
                    </td>
                    <td style={{ fontWeight: 700 }}>{order.total?.toLocaleString()} {order.currency}</td>
                    <td>
                      <StatusPipeline
                        status={order.status}
                        size="sm"
                        onAdvance={(newStatus) => updateStatus(order.id, newStatus)}
                      />
                    </td>
                    <td>
                      <span className={`channel-badge ${order.channel}`}>
                        {getChannel(order.channel).emoji} {getChannel(order.channel).label}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{formatDate(order.created_at)}</td>
                    <td>
                      <button className="topbar-btn" style={{ width: 30, height: 30 }} title="View" onClick={() => setViewOrder(order)}>
                        <Eye size={14} />
                      </button>
                      <button
                        className="topbar-btn"
                        style={{ width: 30, height: 30, marginLeft: 4 }}
                        title="Track Shipment"
                        onClick={() => { window.open(`/dashboard/shipping?order=${order.id}`, '_self'); }}
                      >
                        <Truck size={14} />
                      </button>
                      {order.payment_status !== "paid" && (
                        <button className="topbar-btn" style={{ width: 30, height: 30, marginLeft: 4 }} title="Generate Payment Link" onClick={() => generatePaymentLink(order.id)} disabled={generatingLink === order.id}>
                          {generatingLink === order.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan="8"><EmptyState type="orders" title="No orders yet" description="Your first order will appear here once a customer places one." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* ═══ Order Detail Modal ═══ */}
      {viewOrder && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewOrder(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Order {viewOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setViewOrder(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {/* Status & Date */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
                <span className={`status-badge ${statusColors[viewOrder.status] || ""}`}>
                  {viewOrder.status?.charAt(0).toUpperCase() + viewOrder.status?.slice(1)}
                </span>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                  {formatDate(viewOrder.created_at)}
                </span>
              </div>

              {/* Customer Info */}
              <div style={{ background: "var(--bg-glass)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-lg)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-sm)" }}>Customer</div>
                <div style={{ fontWeight: 600 }}>{viewOrder.customer?.name || "Unknown"}</div>
                {viewOrder.customer?.phone && <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>{viewOrder.customer.phone}</div>}
              </div>

              {/* Items */}
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: "var(--space-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Package size={12} /> Items
                </div>
                {(viewOrder.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-sm) 0", borderBottom: i < viewOrder.items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <span style={{ fontSize: "var(--font-size-sm)" }}>{item.qty}x {item.name}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>{(item.price * item.qty)?.toLocaleString()} {viewOrder.currency}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "var(--space-sm)", marginTop: "var(--space-sm)", borderTop: "2px solid var(--border-medium)" }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: "var(--font-size-lg)", color: "var(--accent-green)" }}>{viewOrder.total?.toLocaleString()} {viewOrder.currency}</span>
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div style={{ background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <CreditCard size={10} /> Payment
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                    {viewOrder.payment_status?.charAt(0).toUpperCase() + viewOrder.payment_status?.slice(1) || "Unpaid"}
                  </div>
                  {viewOrder.payment_method && <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{viewOrder.payment_method}</div>}
                </div>
                <div style={{ background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    Channel
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                    {getChannel(viewOrder.channel).emoji} {getChannel(viewOrder.channel).label}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {viewOrder.shipping_address && (
                <div style={{ background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", marginTop: "var(--space-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <MapPin size={10} /> Shipping Address
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)" }}>{viewOrder.shipping_address}</div>
                  {viewOrder.tracking_number && <div style={{ fontSize: 10, color: "var(--accent-primary-light)", marginTop: 4 }}>Tracking: {viewOrder.tracking_number}</div>}
                </div>
              )}

              {/* Notes */}
              {viewOrder.notes && (
                <div style={{ background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", marginTop: "var(--space-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <StickyNote size={10} /> Notes
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>{viewOrder.notes}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {viewOrder.payment_status !== "paid" && (
                <button className="btn btn-secondary" onClick={() => generatePaymentLink(viewOrder.id)} disabled={generatingLink === viewOrder.id} style={{ marginRight: "auto" }}>
                  {generatingLink === viewOrder.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={14} />}
                  {viewOrder.payment_link ? "Copy Payment Link" : "Generate Payment Link"}
                </button>
              )}
              {viewOrder.status === "delivered" && (
                <button className="btn btn-secondary" onClick={() => sendReviewRequest(viewOrder.id)} disabled={sendingReview === viewOrder.id} style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  {sendingReview === viewOrder.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Star size={14} />}
                  {sendingReview === viewOrder.id ? "Copying..." : "Copy Review Link"}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setViewOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
