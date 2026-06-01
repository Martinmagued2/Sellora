"use client";

import { useState, useEffect } from "react";
import { Search, DollarSign, ShoppingBag, TrendingUp, Clock, RefreshCw } from "lucide-react";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchOrders = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/orders?${params}`, {
        headers: { "x-account-id": ADMIN_ACCOUNT_ID },
      });
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
        setPagination(json.data.pagination);
        if (json.data.stats) setStats(json.data.stats);
      }
    } catch (e) {
      console.error("Failed to fetch orders:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => { await fetchOrders(1); };
    load();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const statusColors = {
    pending: "var(--accent-orange)",
    confirmed: "var(--accent-primary-light)",
    shipped: "var(--accent-secondary)",
    delivered: "var(--accent-green)",
    cancelled: "var(--accent-red)",
  };

  return (
    <>
      <div className="page-header">
        <h1>Orders & Revenue</h1>
      </div>

      {/* Revenue KPI Cards */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Total Revenue</span>
              <div className="stat-card-icon admin-orange"><DollarSign size={18} /></div>
            </div>
            <div className="stat-card-value">{stats.totalRevenue.toLocaleString()}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>EGP (paid)</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Avg Order Value</span>
              <div className="stat-card-icon blue"><TrendingUp size={18} /></div>
            </div>
            <div className="stat-card-value">{stats.avgOrderValue.toLocaleString()}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>EGP</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Total Orders</span>
              <div className="stat-card-icon green"><ShoppingBag size={18} /></div>
            </div>
            <div className="stat-card-value">{stats.totalOrders}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
              {stats.totalPaidOrders} paid
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Pending Orders</span>
              <div className="stat-card-icon admin-red"><Clock size={18} /></div>
            </div>
            <div className="stat-card-value">{stats.ordersByStatus?.pending || 0}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
              {stats.ordersByStatus?.confirmed || 0} confirmed
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {["", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((st) => (
            <button
              key={st}
              className={`filter-tab ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st ? st.charAt(0).toUpperCase() + st.slice(1) : "All Status"}
            </button>
          ))}
        </div>

        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {/* Table */}
      <div className="admin-table-container">
        {loading ? (
          <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
            <RefreshCw size={20} className="spin" style={{ display: "inline-block" }} />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Account</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>
                      {order.order_number || order.id.slice(0, 8)}
                    </td>
                    <td style={{ fontSize: "var(--font-size-sm)" }}>
                      {order.account?.business_name || "—"}
                    </td>
                    <td style={{ fontSize: "var(--font-size-sm)" }}>
                      {order.customer?.name || "—"}
                    </td>
                    <td style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {order.total?.toLocaleString()} {order.currency || "EGP"}
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: order.payment_status === "paid"
                          ? "rgba(0, 230, 118, 0.1)" : "rgba(248, 165, 50, 0.1)",
                        color: order.payment_status === "paid" ? "var(--accent-green)" : "var(--accent-orange)",
                      }}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchOrders(pagination.page - 1)}>Previous</button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchOrders(pagination.page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
