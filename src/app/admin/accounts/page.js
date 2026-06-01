"use client";

import { useState, useEffect } from "react";
import { Search, Users, ChevronDown, ChevronUp, Shield, Ban, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const fetchAccounts = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (planFilter) params.set("plan", planFilter);

      const res = await fetch(`/api/admin/accounts?${params}`, {
        headers: { "x-account-id": ADMIN_ACCOUNT_ID },
      });
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data.accounts);
        setPagination(json.data.pagination);
      }
    } catch (e) {
      console.error("Failed to fetch accounts:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => { await fetchAccounts(1); };
    load();
  }, [planFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAccounts(1);
  };

  const handleAccountAction = async (accountId, action) => {
    setActionLoading((prev) => ({ ...prev, [accountId]: true }));
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-account-id": ADMIN_ACCOUNT_ID,
        },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        fetchAccounts(pagination.page);
      } else {
        alert(json.error || "Action failed");
      }
    } catch (e) {
      alert("Network error");
    }
    setActionLoading((prev) => ({ ...prev, [accountId]: false }));
  };

  const planColors = {
    starter: "var(--text-tertiary)",
    professional: "var(--accent-primary-light)",
    business: "#E84327",
  };

  return (
    <>
      {/* Header & Filters */}
      <div className="page-header">
        <h1>Accounts</h1>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {["", "starter", "professional", "business"].map((plan) => (
            <button
              key={plan}
              className={`filter-tab ${planFilter === plan ? "active" : ""}`}
              onClick={() => setPlanFilter(plan)}
            >
              {plan || "All"}
            </button>
          ))}
        </div>

        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search accounts..."
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
            <div style={{ marginTop: "var(--space-sm)" }}>Loading accounts...</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Plan</th>
                <th>Email</th>
                <th>Channels</th>
                <th>AI</th>
                <th>Customers</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <>
                  <tr key={account.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "var(--accent-gradient)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {(account.business_name || account.owner_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{account.business_name || account.owner_name || "Unknown"}</div>
                          {account.plan_status === "canceled" && (
                            <span style={{ fontSize: 10, color: "var(--accent-red)", fontWeight: 600 }}>CANCELED</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: `${planColors[account.plan] || "var(--text-tertiary)"}18`,
                        color: planColors[account.plan] || "var(--text-tertiary)",
                        textTransform: "capitalize",
                      }}>
                        {account.plan}
                      </span>
                    </td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{account.email}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {account.instagram_connected && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(225, 48, 108, 0.1)", color: "#E1306C", fontWeight: 600 }}>IG</span>}
                        {account.facebook_connected && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(24, 119, 242, 0.1)", color: "#1877F2", fontWeight: 600 }}>FB</span>}
                        {account.whatsapp_connected && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(37, 211, 102, 0.1)", color: "#25D366", fontWeight: 600 }}>WA</span>}
                        {!account.instagram_connected && !account.facebook_connected && !account.whatsapp_connected && (
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {account.ai_enabled ? (
                        <span style={{ color: "var(--accent-green)", fontWeight: 600, fontSize: "var(--font-size-xs)" }}>ON</span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>OFF</span>
                      )}
                    </td>
                    <td>{account.customer_count}</td>
                    <td>{account.order_count}</td>
                    <td style={{ fontWeight: 700 }}>{account.total_revenue.toLocaleString()} EGP</td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                      {new Date(account.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {expandedId === account.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {expandedId === account.id && (
                    <tr key={`${account.id}-detail`}>
                      <td colSpan={10} style={{ background: "var(--bg-glass)", padding: "var(--space-lg)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-lg)" }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>Account Details</div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>ID:</strong> <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{account.id}</span>
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Owner:</strong> {account.owner_name || "N/A"}
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Industry:</strong> {account.industry || "N/A"}
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Country:</strong> {account.country || "N/A"}
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Plan Status:</strong> {account.plan_status || "active"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>AI Configuration</div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>AI Enabled:</strong> {account.ai_enabled ? "Yes" : "No"}
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Auto Greeting:</strong> {account.auto_greeting ? "Yes" : "No"}
                            </div>
                            <div style={{ fontSize: "var(--font-size-sm)", marginBottom: 4 }}>
                              <strong>Personality:</strong> {account.ai_personality || "Default"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>Actions</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                              <button
                                className="admin-action-btn upgrade"
                                onClick={() => handleAccountAction(account.id, "upgrade")}
                                disabled={actionLoading[account.id]}
                              >
                                <ArrowUpCircle size={14} /> Upgrade Plan
                              </button>
                              <button
                                className="admin-action-btn demote"
                                onClick={() => handleAccountAction(account.id, "downgrade")}
                                disabled={actionLoading[account.id]}
                              >
                                <ArrowDownCircle size={14} /> Downgrade Plan
                              </button>
                              <button
                                className="admin-action-btn suspend"
                                onClick={() => handleAccountAction(account.id, account.plan_status === "canceled" ? "reactivate" : "suspend")}
                                disabled={actionLoading[account.id]}
                              >
                                <Ban size={14} /> {account.plan_status === "canceled" ? "Reactivate" : "Suspend"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
                    No accounts found
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
          <button
            className="btn btn-secondary btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchAccounts(pagination.page - 1)}
          >
            Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchAccounts(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
