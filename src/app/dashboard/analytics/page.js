"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, MessageCircle, ShoppingBag,
  Users, DollarSign, Bot, Clock, Target, Zap,
  ArrowUpRight, Activity, Download, Lock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accountPlan, setAccountPlan] = useState("starter");

  useEffect(() => {
    const fetchAnalytics = async () => {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: account } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
        if (account?.plan) setAccountPlan(account.plan);
      }
      if (!user) return;

      // Get user's conversation IDs first (messages table doesn't have account_id)
      const { data: userConvs } = await supabase
        .from("conversations")
        .select("id, status, channel, converted, created_at")
        .eq("account_id", user.id);
      const convIds = (userConvs || []).map(c => c.id);
      const conversations = userConvs || [];

      const [
        ordersRes, customersRes, messagesRes,
        aiMsgRes, intentMsgsRes, topProductsRes,
        topCustomersRes, responseTimesRes, recentConvsRes,
      ] = await Promise.all([
        supabase.from("orders").select("total, payment_status, created_at, status, channel, items").eq("account_id", user.id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", user.id),
        convIds.length > 0
          ? supabase.from("messages").select("id, created_at, direction, intent").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(500)
          : { data: [], count: 0 },
        convIds.length > 0
          ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_ai", true).in("conversation_id", convIds)
          : { count: 0, data: [] },
        convIds.length > 0
          ? supabase.from("messages").select("intent").in("conversation_id", convIds).not("intent", "is", null).not("intent", "eq", "general")
          : { data: [] },
        supabase.from("orders").select("items, total").eq("account_id", user.id).eq("payment_status", "paid"),
        supabase.from("customers").select("name, total_orders, total_spent, channel, platform").eq("account_id", user.id).order("total_spent", { ascending: false }).limit(10),
        convIds.length > 0
          ? supabase.from("messages").select("response_time_seconds").in("conversation_id", convIds).not("response_time_seconds", "is", null)
          : { data: [] },
        supabase.from("conversations").select("created_at, channel").eq("account_id", user.id).order("created_at", { ascending: false }).limit(200),
      ]);

      const orders = ordersRes.data || [];
      const messages = messagesRes.data || [];
      const allIntentMsgs = intentMsgsRes.data || [];
      const totalMessages = messagesRes.count || messages.length;
      const aiMessages = aiMsgRes.count || 0;
      const convertedCount = conversations.filter(c => c.converted).length;
      const totalConvs = conversations.length;
      const revenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (o.total || 0), 0);

      // Conversion funnel
      const conversionRate = totalConvs > 0 ? ((convertedCount / totalConvs) * 100).toFixed(1) : 0;

      // AI rate
      const aiPct = totalMessages > 0 ? ((aiMessages / totalMessages) * 100).toFixed(1) : 0;

      // Avg response time
      const responseTimes = (responseTimesRes.data || []).map(r => r.response_time_seconds).filter(Boolean);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Revenue per conversation
      const revenuePerConv = totalConvs > 0 ? Math.round(revenue / totalConvs) : 0;

      // Avg order value
      const paidOrders = orders.filter(o => o.payment_status === "paid");
      const avgOrderValue = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;

      // Intent distribution
      const intentCounts = {};
      allIntentMsgs.forEach(m => {
        intentCounts[m.intent] = (intentCounts[m.intent] || 0) + 1;
      });
      const intentData = Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count);

      // Channel distribution
      const igConvs = conversations.filter(c => c.channel === "instagram").length;
      const fbConvs = conversations.filter(c => c.channel === "facebook").length;
      const waConvs = conversations.filter(c => c.channel === "whatsapp").length;

      // Peak hours heatmap (7 days x 24 hours)
      const hourCounts = new Array(24).fill(0);
      const dayCounts = new Array(7).fill(0);
      messages.forEach(m => {
        const d = new Date(m.created_at);
        hourCounts[d.getHours()]++;
        dayCounts[d.getDay()]++;
      });
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const peakDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

      // Top products by revenue
      const productRevenue = {};
      (topProductsRes.data || []).forEach(order => {
        (order.items || []).forEach(item => {
          const name = item.name || "Unknown";
          productRevenue[name] = (productRevenue[name] || 0) + (item.price || 0) * (item.qty || 1);
        });
      });
      const topProducts = Object.entries(productRevenue)
        .map(([name, rev]) => ({ name, revenue: rev }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setStats({
        revenue, totalOrders: orders.length, totalCustomers: customersRes.count || 0,
        totalConversations: totalConvs, totalMessages, aiMessages, aiPct,
        convertedCount, conversionRate, avgResponseTime, revenuePerConv, avgOrderValue,
        igConvs, fbConvs, waConvs,
        intentData, topProducts,
        topCustomers: topCustomersRes.data || [],
        hourCounts, peakHour, peakDay,
        paidOrdersCount: paidOrders.length,
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading || !stats) {
    return <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading analytics...</div>;
  }

  const intentColors = {
    price_inquiry: "#F8A532", order: "#3BA55C", product_info: "#5865F2",
    complaint: "#ED4245", order_status: "#00D2FF", return: "#EB459E",
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const maxHourCount = Math.max(...stats.hourCounts, 1);
  const planLimits = getPlanLimits(accountPlan);

  const handleExportCSV = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: exportOrders } = await supabase.from("orders").select("*").eq("account_id", user.id).order("created_at", { ascending: false });
    if (!exportOrders || exportOrders.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ["Order ID", "Date", "Total", "Status", "Payment Status", "Channel"];
    const csvContent = [
      headers.join(","),
      ...exportOrders.map(o => [
        o.id,
        new Date(o.created_at).toLocaleDateString(),
        o.total,
        o.status,
        o.payment_status,
        o.channel
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sellora_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="page-header">
        <h1>Analytics</h1>
        <div className="page-header-actions">
          {planLimits.csv_export && (
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ═══ Top KPIs ═══ */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-lg)" }}>
        {[
          { icon: <DollarSign size={18} />, color: "green", value: `${stats.revenue.toLocaleString()} EGP`, label: "Total Revenue" },
          { icon: <Target size={18} />, color: "purple", value: `${stats.conversionRate}%`, label: "Conversion Rate" },
          { icon: <Clock size={18} />, color: "blue", value: stats.avgResponseTime > 0 ? formatTime(stats.avgResponseTime) : "—", label: "Avg Response Time" },
          { icon: <Bot size={18} />, color: "orange", value: `${stats.aiPct}%`, label: "AI Resolution" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
            </div>
            <div className="stat-card-value">{s.value}</div>
          </div>
        ))}
      </div>

      {!planLimits.analytics_full ? (
        <div className="dashboard-panel" style={{ padding: "var(--space-4xl)", textAlign: "center", border: "1px dashed var(--accent-primary)", background: "rgba(108, 92, 231, 0.02)" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(108, 92, 231, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-xl)", color: "var(--accent-primary)" }}>
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: "var(--font-size-2xl)", marginBottom: "var(--space-md)" }}>Unlock Advanced Analytics</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto var(--space-xl)", lineHeight: 1.6 }}>
            Upgrade to the Professional or Business plan to see conversion funnels, activity heatmaps, intent distribution, and channel performance metrics.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => window.location.href = '/dashboard/billing'}>
            Upgrade Plan
          </button>
        </div>
      ) : (
        <>
          {/* ═══ Conversion Funnel ═══ */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="dashboard-panel-header"><h3>Conversion Funnel</h3></div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
            {[
              { label: "Messages", value: stats.totalMessages, color: "var(--text-secondary)", width: 100 },
              { label: "Conversations", value: stats.totalConversations, color: "var(--accent-primary-light)", width: stats.totalMessages > 0 ? Math.max(20, (stats.totalConversations / stats.totalMessages) * 100 * 5) : 60 },
              { label: "Orders", value: stats.totalOrders, color: "var(--accent-orange)", width: stats.totalConversations > 0 ? Math.max(15, (stats.totalOrders / stats.totalConversations) * 100 * 2) : 40 },
              { label: "Paid", value: stats.paidOrdersCount, color: "var(--accent-green)", width: stats.totalOrders > 0 ? Math.max(10, (stats.paidOrdersCount / stats.totalOrders) * 100 * 1.5) : 20 },
            ].map((step, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: 60, background: `${step.color}22`, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${step.color}33`, marginBottom: 8,
                }}>
                  <span style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: step.color }}>{step.value.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{step.label}</div>
                {i < 3 && (
                  <div style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>→</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)", marginTop: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--accent-primary-light)" }}>{stats.revenuePerConv.toLocaleString()} EGP</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Revenue per Conversation</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--accent-green)" }}>{stats.avgOrderValue.toLocaleString()} EGP</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Avg Order Value</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--accent-orange)" }}>{stats.conversionRate}%</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Chat → Order Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Middle: Activity Heatmap + Intent Distribution ═══ */}
      <div className="dashboard-grid" style={{ marginBottom: "var(--space-lg)" }}>
        {/* Activity Heatmap */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h3>Peak Activity Hours</h3>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Busiest: {stats.peakHour}:00 on {stats.peakDay}</span>
          </div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3 }}>
              {stats.hourCounts.map((count, hour) => {
                const intensity = count / maxHourCount;
                return (
                  <div key={hour} title={`${hour}:00 — ${count} messages`} style={{
                    height: 36, borderRadius: 6, display: "flex", alignItems: "flex-end", justifyContent: "center",
                    background: intensity > 0.7 ? "rgba(88, 101, 242, 0.5)" : intensity > 0.4 ? "rgba(88, 101, 242, 0.25)" : intensity > 0.1 ? "rgba(88, 101, 242, 0.1)" : "var(--bg-glass)",
                    cursor: "default", transition: "all 0.3s",
                    fontSize: 9, fontWeight: 600, color: intensity > 0.4 ? "white" : "var(--text-tertiary)", paddingBottom: 4,
                  }}>
                    {hour}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "var(--space-md)", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Low</span>
              {[0.1, 0.25, 0.5].map((o, i) => (
                <div key={i} style={{ width: 16, height: 10, borderRadius: 3, background: `rgba(88, 101, 242, ${o})` }} />
              ))}
              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>High</span>
            </div>
          </div>
        </div>

        {/* Intent Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Customer Intents</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {stats.intentData.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No intent data yet. Intents are detected from incoming messages.</p>
            ) : stats.intentData.map((item, i) => {
              const total = stats.intentData.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={i} style={{ marginBottom: i < stats.intentData.length - 1 ? "var(--space-md)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", textTransform: "capitalize" }}>
                      {item.intent.replace("_", " ")}
                    </span>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{item.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, width: `${pct}%`,
                      background: intentColors[item.intent] || "var(--accent-primary-light)",
                      transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Bottom: Top Products + Top Customers ═══ */}
      <div className="dashboard-grid">
        {/* Top Products */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Top Products by Revenue</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-md)" }}>
            {stats.topProducts.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No paid orders yet</p>
            ) : stats.topProducts.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
                borderRadius: 12, marginBottom: 4,
                background: i === 0 ? "rgba(59, 165, 92, 0.06)" : "transparent",
                border: i === 0 ? "1px solid rgba(59, 165, 92, 0.15)" : "1px solid transparent",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: i === 0 ? "var(--accent-green)" : "var(--bg-glass)",
                  color: i === 0 ? "white" : "var(--text-tertiary)",
                  border: i > 0 ? "1px solid var(--border-subtle)" : "none",
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontWeight: 500, fontSize: "var(--font-size-sm)" }}>{p.name}</div>
                <div style={{ fontWeight: 800, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>
                  {p.revenue.toLocaleString()} EGP
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Valuable Customers */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Most Valuable Customers</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-md)" }}>
            {stats.topCustomers.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No customers yet</p>
            ) : stats.topCustomers.slice(0, 5).map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
                borderRadius: 12, marginBottom: 4,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: i === 0 ? "var(--accent-gradient)" : "var(--bg-glass)",
                  border: i > 0 ? "1px solid var(--border-subtle)" : "none",
                }}>
                  {i === 0 ? "👑" : (i + 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{c.total_orders} orders • {c.platform || c.channel}</div>
                </div>
                <div style={{ fontWeight: 800, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>
                  {c.total_spent?.toLocaleString()} EGP
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Channel Performance Comparison ═══ */}
      <div className="dashboard-panel" style={{ marginTop: "var(--space-lg)" }}>
        <div className="dashboard-panel-header"><h3>Channel Performance</h3></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Instagram", count: stats.igConvs, color: "#E1306C" },
            { label: "Facebook", count: stats.fbConvs, color: "#1877F2" },
            { label: "WhatsApp", count: stats.waConvs, color: "#25D366" },
          ].map((ch, i) => (
            <div key={i} style={{
              padding: "var(--space-xl)", textAlign: "center",
              borderRight: i < 2 ? "1px solid var(--border-subtle)" : "none",
            }}>
              <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: ch.color, marginBottom: 4 }}>
                {ch.count}
              </div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{ch.label}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                {stats.totalConversations > 0 ? Math.round((ch.count / stats.totalConversations) * 100) : 0}% of chats
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </>
  );
}
