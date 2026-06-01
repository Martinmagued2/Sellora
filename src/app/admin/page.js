"use client";

import { useState, useEffect } from "react";
import {
  Users, MessageCircle, ShoppingBag, DollarSign, Bot, Activity,
  TrendingUp, Camera, Globe2, Phone,
} from "lucide-react";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/overview", {
          headers: { "x-account-id": ADMIN_ACCOUNT_ID },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load data");
        }
      } catch (e) {
        setError("Network error");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
        <Activity size={24} className="spin" style={{ display: "inline-block", marginBottom: "var(--space-md)" }} />
        <div>Loading admin overview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--accent-red)" }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { accounts, conversations, messages, orders, aiAutoReplies, charts } = data;

  // Chart helper
  const renderBarChart = (items, valueKey, label, colorClass = "") => {
    const values = items.map((i) => i[valueKey]);
    const maxVal = Math.max(...values, 1);
    return (
      <div style={{ position: "relative", height: 180 }}>
        <div className="chart-bars">
          {items.map((item, idx) => {
            const val = item[valueKey];
            const pct = (val / maxVal) * 100;
            return (
              <div
                key={idx}
                className={`admin-chart-bar ${colorClass}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
                title={`${item.date}: ${typeof val === "number" ? val.toLocaleString() : val}`}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, position: "absolute", bottom: -20, left: 0, right: 0 }}>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{items[0]?.date?.slice(5)}</span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{items[Math.floor(items.length / 2)]?.date?.slice(5)}</span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{items[items.length - 1]?.date?.slice(5)}</span>
        </div>
      </div>
    );
  };

  const channelData = [
    { name: "Instagram", count: conversations.byChannel.instagram, color: "#E1306C", Icon: Camera },
    { name: "Facebook", count: conversations.byChannel.facebook, color: "#1877F2", Icon: Globe2 },
    { name: "WhatsApp", count: conversations.byChannel.whatsapp, color: "#25D366", Icon: Phone },
  ];

  const planData = [
    { name: "Starter", count: accounts.byPlan.starter, color: "var(--text-secondary)" },
    { name: "Professional", count: accounts.byPlan.professional, color: "var(--accent-primary-light)" },
    { name: "Business", count: accounts.byPlan.business, color: "#E84327" },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Accounts</span>
            <div className="stat-card-icon admin-red"><Users size={18} /></div>
          </div>
          <div className="stat-card-value">{accounts.total}</div>
          <div className="stat-card-change">
            <span className="up">+{accounts.newThisWeek}</span>
            <span className="stat-card-period">this week</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Active Accounts</span>
            <div className="stat-card-icon green"><Activity size={18} /></div>
          </div>
          <div className="stat-card-value">{accounts.active}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {accounts.total > 0 ? Math.round((accounts.active / accounts.total) * 100) : 0}% of total
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Messages</span>
            <div className="stat-card-icon blue"><MessageCircle size={18} /></div>
          </div>
          <div className="stat-card-value">{messages.total.toLocaleString()}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {messages.incoming} in / {messages.outgoing} out
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Orders</span>
            <div className="stat-card-icon green"><ShoppingBag size={18} /></div>
          </div>
          <div className="stat-card-value">{orders.total}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            Across all accounts
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Revenue</span>
            <div className="stat-card-icon admin-orange"><DollarSign size={18} /></div>
          </div>
          <div className="stat-card-value">{orders.totalRevenue.toLocaleString()}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>EGP paid</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">AI Replies Today</span>
            <div className="stat-card-icon purple"><Bot size={18} /></div>
          </div>
          <div className="stat-card-value">{aiAutoReplies.today}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {aiAutoReplies.thisWeek} this week
          </div>
        </div>
      </div>

      {/* Distribution Row */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Plan Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Plan Distribution</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {planData.map((plan, i) => {
              const pct = accounts.total > 0 ? Math.round((plan.count / accounts.total) * 100) : 0;
              return (
                <div key={i} style={{ marginBottom: i < planData.length - 1 ? "var(--space-md)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{plan.name}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      {plan.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, width: `${pct}%`,
                      background: plan.color,
                      transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Channel Distribution</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {channelData.map((ch, i) => {
              const pct = conversations.total > 0 ? Math.round((ch.count / conversations.total) * 100) : 0;
              return (
                <div key={i} style={{ marginBottom: i < channelData.length - 1 ? "var(--space-md)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                      <ch.Icon size={14} style={{ color: ch.color }} />
                      {ch.name}
                    </span>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      {ch.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, width: `${pct}%`,
                      background: ch.color,
                      transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Messages Chart */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Messages (30 days)</h3>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Total: {messages.total.toLocaleString()}
            </span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg) var(--space-md)" }}>
            {renderBarChart(charts.messagesPerDay, "count", "Messages")}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Revenue (30 days)</h3>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {orders.totalRevenue.toLocaleString()} EGP
            </span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg) var(--space-md)" }}>
            {renderBarChart(charts.revenuePerDay, "revenue", "Revenue", "green")}
          </div>
        </div>
      </div>

      {/* Account Growth */}
      <div className="dashboard-panel" style={{ marginTop: "var(--space-lg)" }}>
        <div className="dashboard-panel-header">
          <h3>Account Growth (30 days)</h3>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {accounts.newThisMonth} new this month
          </span>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-lg) var(--space-md)" }}>
          {renderBarChart(charts.accountGrowthPerDay, "total", "Accounts", "purple")}
        </div>
      </div>
    </>
  );
}
