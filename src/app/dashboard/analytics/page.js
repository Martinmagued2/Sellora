"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, TrendingUp, MessageCircle, ShoppingBag,
  Users, DollarSign, Bot, Clock, Target, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Download, Lock,
  ChevronRight, Calendar, RefreshCw, Sparkles, AlertTriangle,
  Heart, Meh, Frown, Flame, Package, CreditCard, Smartphone,
  FileText, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/ToastProvider";
import { getPlanLimits } from "@/lib/plan-limits";

function TrendArrow({ value }) {
  if (value == null || value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`stat-card-trend ${isUp ? "up" : "down"}`}>
      {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value)}%
    </span>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [aiData, setAiData] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accountPlan, setAccountPlan] = useState("starter");
  const [dateRange, setDateRange] = useState("30d");
  const [activeSection, setActiveSection] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fetch base stats (existing logic)
  const fetchBaseStats = useCallback(async (userId) => {
    const supabase = createClient();
    const { data: userConvs } = await supabase
      .from("conversations")
      .select("id, status, channel, converted, created_at")
      .eq("account_id", userId);
    const convIds = (userConvs || []).map(c => c.id);
    const conversations = userConvs || [];

    const [
      ordersRes, customersRes, messagesRes,
      aiMsgRes, intentMsgsRes, topProductsRes,
      topCustomersRes, responseTimesRes,
    ] = await Promise.all([
      supabase.from("orders").select("total, payment_status, created_at, status, channel, items").eq("account_id", userId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("account_id", userId),
      convIds.length > 0
        ? supabase.from("messages").select("id, created_at, direction, intent").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(500)
        : { data: [], count: 0 },
      convIds.length > 0
        ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_ai", true).in("conversation_id", convIds)
        : { count: 0, data: [] },
      convIds.length > 0
        ? supabase.from("messages").select("intent").in("conversation_id", convIds).not("intent", "is", null).not("intent", "eq", "general")
        : { data: [] },
      supabase.from("orders").select("items, total").eq("account_id", userId).eq("payment_status", "paid"),
      supabase.from("customers").select("name, total_orders, total_spent, channel, platform").eq("account_id", userId).order("total_spent", { ascending: false }).limit(10),
      convIds.length > 0
        ? supabase.from("messages").select("response_time_seconds").in("conversation_id", convIds).not("response_time_seconds", "is", null)
        : { data: [] },
    ]);

    const orders = ordersRes.data || [];
    const messages = messagesRes.data || [];
    const allIntentMsgs = intentMsgsRes.data || [];
    const totalMessages = messagesRes.count || messages.length;
    const aiMessages = aiMsgRes.count || 0;
    const convertedCount = conversations.filter(c => c.converted).length;
    const totalConvs = conversations.length;
    const revenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (o.total || 0), 0);
    const conversionRate = totalConvs > 0 ? ((convertedCount / totalConvs) * 100).toFixed(1) : 0;
    const aiPct = totalMessages > 0 ? ((aiMessages / totalMessages) * 100).toFixed(1) : 0;
    const responseTimes = (responseTimesRes.data || []).map(r => r.response_time_seconds).filter(Boolean);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    const revenuePerConv = totalConvs > 0 ? Math.round(revenue / totalConvs) : 0;
    const paidOrders = orders.filter(o => o.payment_status === "paid");
    const avgOrderValue = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;
    const intentCounts = {};
    allIntentMsgs.forEach(m => { intentCounts[m.intent] = (intentCounts[m.intent] || 0) + 1; });
    const intentData = Object.entries(intentCounts).map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count);
    const igConvs = conversations.filter(c => c.channel === "instagram").length;
    const fbConvs = conversations.filter(c => c.channel === "facebook").length;
    const waConvs = conversations.filter(c => c.channel === "whatsapp").length;
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    messages.forEach(m => { const d = new Date(m.created_at); hourCounts[d.getHours()]++; dayCounts[d.getDay()]++; });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const peakDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];
    const productRevenue = {};
    (topProductsRes.data || []).forEach(order => {
      (order.items || []).forEach(item => {
        const name = item.name || "Unknown";
        productRevenue[name] = (productRevenue[name] || 0) + (item.price || 0) * (item.qty || 1);
      });
    });
    const topProducts = Object.entries(productRevenue).map(([name, rev]) => ({ name, revenue: rev })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      revenue, totalOrders: orders.length, totalCustomers: customersRes.count || 0,
      totalConversations: totalConvs, totalMessages, aiMessages, aiPct,
      convertedCount, conversionRate, avgResponseTime, revenuePerConv, avgOrderValue,
      igConvs, fbConvs, waConvs,
      intentData, topProducts,
      topCustomers: topCustomersRes.data || [],
      hourCounts, peakHour, peakDay,
      paidOrdersCount: paidOrders.length,
    };
  }, []);

  // Fetch analytics API data
  const fetchAnalyticsData = useCallback(async (range) => {
    try {
      const [salesRes, customersRes, aiRes, funnelRes] = await Promise.all([
        fetch(`/api/analytics/sales?range=${range}`),
        fetch(`/api/analytics/customers`),
        fetch(`/api/analytics/ai-performance`),
        fetch(`/api/analytics/funnel?range=${range}`),
      ]);

      const [sales, customers, ai, funnel] = await Promise.all([
        salesRes.json(), customersRes.json(), aiRes.json(), funnelRes.json(),
      ]);

      if (sales.success) setSalesData(sales.data);
      if (customers.success) setCustomerData(customers.data);
      if (ai.success) setAiData(ai.data);
      if (funnel.success) setFunnelData(funnel.data);
    } catch (error) {
      console.error("Failed to fetch analytics data:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: account } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (account?.plan) setAccountPlan(account.plan);

      const baseStats = await fetchBaseStats(user.id);
      setStats(baseStats);
      setLoading(false);

      // Fetch enhanced analytics data
      fetchAnalyticsData(dateRange);
    };
    init();
  }, [fetchBaseStats, fetchAnalyticsData, dateRange]);

  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  if (loading || !stats) {
    return <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading analytics...</div>;
  }

  const intentColors = {
    price_inquiry: "#F8A532", order: "#3BA55C", product_info: "#5865F2",
    complaint: "#ED4245", order_status: "#00D2FF", return: "#EB459E",
  };

  const formatTime = (seconds) => {
    if (seconds == null) return "—";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return "—";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const maxHourCount = Math.max(...stats.hourCounts, 1);
  const planLimits = getPlanLimits(accountPlan);

  const handleExportCSV = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: exportOrders } = await supabase.from("orders").select("*").eq("account_id", user.id).order("created_at", { ascending: false });
    if (!exportOrders || exportOrders.length === 0) { toast.warning("No data to export"); return; }
    const headers = ["Order ID", "Date", "Total", "Status", "Payment Status", "Channel"];
    const csvContent = [
      headers.join(","),
      ...exportOrders.map(o => [o.id, new Date(o.created_at).toLocaleDateString(), o.total, o.status, o.payment_status, o.channel].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `sellora_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/analytics/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateRange, reportType: "overview" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sellora_report_${new Date().toISOString().split('T')[0]}.pdf`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to export PDF: " + err.message);
    }
    setExportingPdf(false);
  };

  return (
    <>
      <div className="page-header">
        <h1>Analytics</h1>
        <div className="page-header-actions">
          {/* Date Range Selector */}
          <div className="filter-tabs" style={{ marginRight: "var(--space-md)" }}>
            {["7d", "30d", "90d", "all"].map(r => (
              <button
                key={r}
                className={`filter-tab ${dateRange === r ? "active" : ""}`}
                onClick={() => handleDateRangeChange(r)}
              >
                {r === "all" ? "All Time" : r.toUpperCase()}
              </button>
            ))}
          </div>
          {planLimits.csv_export && (
            <button className="btn btn-secondary" onClick={handleExportCSV}>
              <Download size={16} /> Export CSV
            </button>
          )}
          {planLimits.csv_export && (
            <button className="btn btn-primary" onClick={handleExportPDF} disabled={exportingPdf}>
              {exportingPdf ? <><Loader2 size={16} className="spin" /> Generating...</> : <><FileText size={16} /> Export PDF</>}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Top KPIs ═══ */}
      <div className="stats-grid" style={{ marginBottom: "var(--space-lg)" }}>
        {[
          { icon: <DollarSign size={18} />, color: "green", value: `${stats.revenue.toLocaleString()} EGP`, label: "Total Revenue", trend: salesData?.revenueTrend },
          { icon: <Target size={18} />, color: "purple", value: `${stats.conversionRate}%`, label: "Conversion Rate", trend: null },
          { icon: <Clock size={18} />, color: "blue", value: stats.avgResponseTime > 0 ? formatTime(stats.avgResponseTime) : "—", label: "Avg Response Time", trend: null },
          { icon: <Bot size={18} />, color: "orange", value: `${stats.aiPct}%`, label: "AI Resolution", trend: null },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TrendArrow value={s.trend} />
                <div className={`stat-card-icon ${s.color}`}>{s.icon}</div>
              </div>
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
          {/* ═══════════════════════════════════════════════════════════════
              FEATURE 14: Enhanced Conversion Funnel
              ═══════════════════════════════════════════════════════════════ */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="dashboard-panel-header">
              <h3>Conversion Funnel</h3>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {funnelData ? `Overall: ${funnelData.conversion.overallConversion}% → Paid` : "Loading..."}
              </span>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {funnelData ? (
                <>
                  {/* Funnel Steps with Drop-off */}
                  <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: "var(--space-xl)" }}>
                    {[
                      { label: "Messages Received", value: funnelData.steps.messages, color: "var(--text-secondary)", icon: <MessageCircle size={16} /> },
                      { label: "Conversations", value: funnelData.steps.conversations, color: "var(--accent-primary-light)", icon: <MessageCircle size={16} /> },
                      { label: "Products Sent", value: funnelData.steps.productsSent, color: "var(--accent-secondary)", icon: <Package size={16} /> },
                      { label: "Orders Created", value: funnelData.steps.ordersCreated, color: "var(--accent-orange)", icon: <ShoppingBag size={16} /> },
                      { label: "Orders Paid", value: funnelData.steps.ordersPaid, color: "var(--accent-green)", icon: <CreditCard size={16} /> },
                    ].map((step, i, arr) => {
                      const maxWidth = arr[0].value > 0 ? Math.max(30, (step.value / arr[0].value) * 100) : 30;
                      const prevValue = i > 0 ? arr[i - 1].value : null;
                      const convPct = prevValue > 0 ? ((step.value / prevValue) * 100).toFixed(1) : null;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                          {/* Conversion arrow between steps */}
                          {i > 0 && (
                            <div style={{
                              position: "absolute", left: -16, top: 28, zIndex: 2,
                              background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                              borderRadius: 8, padding: "2px 6px", fontSize: 10, fontWeight: 700,
                              color: parseFloat(convPct) > 50 ? "var(--accent-green)" : parseFloat(convPct) > 20 ? "var(--accent-orange)" : "var(--accent-red)",
                            }}>
                              {convPct}%
                            </div>
                          )}
                          <div style={{
                            width: "100%", maxWidth: `${maxWidth}%`, minWidth: 60,
                            height: 56, background: `${step.color}18`, borderRadius: 12,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: `1px solid ${step.color}33`, marginBottom: 8,
                            transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                          }}>
                            <span style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: step.color }}>{step.value.toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", display: "flex", alignItems: "center", gap: 3 }}>
                            {step.icon} {step.label}
                          </div>
                          {i > 0 && prevValue > 0 && (
                            <div style={{ fontSize: 9, color: "var(--accent-red)", marginTop: 2, fontWeight: 600 }}>
                              ↓ {funnelData.dropoff[Object.keys(funnelData.dropoff)[i - 1]]}% drop-off
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Avg Time Between Steps + Channel Comparison */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
                    {/* Average Time Between Steps */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Avg Time Between Steps
                      </div>
                      {[
                        { label: "Message → Product", value: funnelData.avgTimeBetweenSteps.messageToProduct, icon: <Zap size={12} /> },
                        { label: "Product → Order", value: funnelData.avgTimeBetweenSteps.productToOrder, icon: <ShoppingBag size={12} /> },
                        { label: "Order → Paid", value: funnelData.avgTimeBetweenSteps.orderToPaid, icon: <CreditCard size={12} /> },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-sm) 0", borderBottom: i < 2 ? "1px solid var(--border-subtle)" : "none" }}>
                          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                            {item.icon} {item.label}
                          </span>
                          <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700 }}>
                            {formatDuration(item.value)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Channel Comparison */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Funnel by Channel
                      </div>
                      {[
                        { label: "Instagram", data: funnelData.funnelByChannel.instagram, color: "#E1306C" },
                        { label: "Facebook", data: funnelData.funnelByChannel.facebook, color: "#1877F2" },
                        { label: "WhatsApp", data: funnelData.funnelByChannel.whatsapp, color: "#25D366" },
                      ].map((ch, i) => {
                        const chConvRate = ch.data?.conversations > 0
                          ? ((ch.data.ordersPaid / ch.data.conversations) * 100).toFixed(1)
                          : 0;
                        return (
                          <div key={i} style={{ marginBottom: i < 2 ? "var(--space-sm)" : 0, padding: "var(--space-sm)", background: "var(--bg-glass)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: ch.color }}>{ch.label}</span>
                              <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: "var(--accent-green)" }}>{chConvRate}% → Paid</span>
                            </div>
                            <div style={{ display: "flex", gap: 3, height: 8 }}>
                              {["messages", "conversations", "productsSent", "ordersCreated", "ordersPaid"].map((step, si) => {
                                const maxVal = ch.data?.messages || 1;
                                const val = ch.data?.[step] || 0;
                                const pct = maxVal > 0 ? Math.max(5, (val / maxVal) * 100) : 5;
                                return (
                                  <div key={si} style={{ flex: 1 }}>
                                    <div style={{
                                      height: "100%", width: `${pct}%`, borderRadius: 2,
                                      background: ch.color, opacity: 1 - si * 0.15,
                                      transition: "width 0.6s ease",
                                    }} />
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: "var(--text-tertiary)" }}>
                              <span>{ch.data?.conversations || 0} convs</span>
                              <span>{ch.data?.ordersPaid || 0} paid</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>Loading funnel data...</div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              Weekly Funnel Trends
              ═══════════════════════════════════════════════════════════════ */}
          {funnelData && funnelData.funnelOverTime && funnelData.funnelOverTime.length > 0 && (
            <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
              <div className="dashboard-panel-header">
                <h3>Weekly Funnel Trends</h3>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  Conversion rate by week
                </span>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-md)", height: 140 }}>
                  {funnelData.funnelOverTime.map((week, i) => {
                    const maxConvs = Math.max(...funnelData.funnelOverTime.map(w => w.conversations), 1);
                    const convPct = (week.conversations / maxConvs) * 100;
                    const orderPct = week.conversations > 0 ? (week.orders / week.conversations) * 100 : 0;
                    const paidPct = week.conversations > 0 ? (week.paid / week.conversations) * 100 : 0;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                        <div style={{ width: "100%", maxWidth: 60, position: "relative", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end", height: "100%" }}>
                          {/* Conversations bar (background) */}
                          <div title={`${week.label}: ${week.conversations} convs, ${week.orders} orders, ${week.paid} paid (${week.conversionRate}% conversion)`} style={{
                            height: `${Math.max(convPct, 4)}%`,
                            background: "rgba(108, 92, 231, 0.15)",
                            borderRadius: "8px 8px 0 0",
                            position: "relative",
                            transition: "all 0.5s ease",
                            cursor: "default",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                          }}>
                            {/* Orders portion */}
                            <div style={{
                              height: week.conversations > 0 ? `${orderPct}%` : 0,
                              background: "rgba(248, 165, 50, 0.4)",
                              borderRadius: week.paid > 0 ? "0" : "8px 8px 0 0",
                              transition: "height 0.5s ease",
                              minHeight: week.orders > 0 ? 3 : 0,
                            }} />
                            {/* Paid portion */}
                            <div style={{
                              height: week.conversations > 0 ? `${paidPct}%` : 0,
                              background: "var(--accent-gradient)",
                              borderRadius: "8px 8px 0 0",
                              transition: "height 0.5s ease",
                              minHeight: week.paid > 0 ? 3 : 0,
                            }} />
                          </div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 6 }}>
                          <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: parseFloat(week.conversionRate) > 20 ? "var(--accent-green)" : parseFloat(week.conversionRate) > 5 ? "var(--accent-orange)" : "var(--text-tertiary)" }}>
                            {week.conversionRate}%
                          </div>
                          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 1 }}>
                            {week.label}
                          </div>
                          <div style={{ fontSize: 8, color: "var(--text-tertiary)", marginTop: 1 }}>
                            {week.conversations}C / {week.paid}P
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", marginTop: "var(--space-lg)", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(108, 92, 231, 0.15)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Conversations</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(248, 165, 50, 0.4)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Orders</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent-gradient)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Paid</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              FEATURE 11: Sales Dashboard Enhancement
              ═══════════════════════════════════════════════════════════════ */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="dashboard-panel-header">
              <h3>Revenue Overview</h3>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {dateRange === "all" ? "All Time" : `Last ${dateRange.toUpperCase()}`}
              </span>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {salesData ? (
                <>
                  {/* Revenue KPI Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-green)" }}>
                        {salesData.totalRevenue.toLocaleString()} EGP
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>Total Revenue</div>
                      <TrendArrow value={salesData.revenueTrend} />
                    </div>
                    <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-primary-light)" }}>
                        {salesData.totalPaidOrders}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>Paid Orders</div>
                      <TrendArrow value={salesData.ordersTrend} />
                    </div>
                    <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-orange)" }}>
                        {salesData.avgOrderValue.toLocaleString()} EGP
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>Avg Order Value</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: salesData.weeklyComparison.change >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {salesData.weeklyComparison.change >= 0 ? "+" : ""}{salesData.weeklyComparison.change}%
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>This Week vs Last</div>
                    </div>
                  </div>

                  {/* Daily Revenue Chart */}
                  <div style={{ marginBottom: "var(--space-xl)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Daily Revenue
                    </div>
                    {salesData.dailyRevenue.length > 0 ? (
                      <div style={{ position: "relative", height: 160 }}>
                        {/* Y-axis labels */}
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 24, width: 50, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          {[...Array(5)].map((_, i) => {
                            const maxRev = Math.max(...salesData.dailyRevenue.map(d => d.revenue), 1);
                            const val = Math.round(maxRev * (1 - i / 4));
                            return <div key={i} style={{ fontSize: 9, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 4 }}>{val.toLocaleString()}</div>;
                          })}
                        </div>
                        {/* Bars */}
                        <div style={{ marginLeft: 56, height: "100%", display: "flex", alignItems: "flex-end", gap: 1, paddingBottom: 24 }}>
                          {salesData.dailyRevenue.map((day, i) => {
                            const maxRev = Math.max(...salesData.dailyRevenue.map(d => d.revenue), 1);
                            const pct = maxRev > 0 ? (day.revenue / maxRev) * 100 : 0;
                            const isToday = i === salesData.dailyRevenue.length - 1;
                            return (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                                <div title={`${day.date}: ${day.revenue.toLocaleString()} EGP (${day.orders} orders)`} style={{
                                  width: "100%", maxWidth: 20, minHeight: day.revenue > 0 ? 4 : 2,
                                  height: `${Math.max(pct, 2)}%`,
                                  background: isToday ? "var(--accent-gradient)" : day.revenue > 0 ? "rgba(108, 92, 231, 0.4)" : "rgba(108, 92, 231, 0.1)",
                                  borderRadius: "3px 3px 0 0", transition: "all 0.4s ease",
                                  cursor: "default",
                                }} />
                                {i % Math.max(1, Math.floor(salesData.dailyRevenue.length / 10)) === 0 && (
                                  <div style={{ fontSize: 8, color: "var(--text-tertiary)", marginTop: 4, whiteSpace: "nowrap" }}>
                                    {day.date.slice(5)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No revenue data yet</p>
                    )}
                  </div>

                  {/* Revenue by Channel + Payment Method */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
                    {/* Revenue by Channel */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Revenue by Channel
                      </div>
                      {[
                        { label: "Instagram", value: salesData.channelRevenue.instagram, color: "#E1306C" },
                        { label: "Facebook", value: salesData.channelRevenue.facebook, color: "#1877F2" },
                        { label: "WhatsApp", value: salesData.channelRevenue.whatsapp, color: "#25D366" },
                      ].map((ch, i) => {
                        const total = Object.values(salesData.channelRevenue).reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((ch.value / total) * 100).toFixed(1) : 0;
                        return (
                          <div key={i} style={{ marginBottom: i < 2 ? "var(--space-md)" : 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: ch.color }}>{ch.label}</span>
                              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{ch.value.toLocaleString()} EGP ({pct}%)</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--bg-glass)" }}>
                              <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: ch.color, transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Revenue by Payment Method */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Revenue by Payment Method
                      </div>
                      {Object.entries(salesData.paymentMethodRevenue).length > 0 ? Object.entries(salesData.paymentMethodRevenue)
                        .sort((a, b) => b[1] - a[1])
                        .map(([method, value], i) => {
                          const total = Object.values(salesData.paymentMethodRevenue).reduce((a, b) => a + b, 0);
                          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          const methodColors = { cod: "#F8A532", paymob: "#5865F2", vodafone_cash: "#E1306C", instapay: "#3BA55C", card: "#00D2FF" };
                          const methodLabels = { cod: "Cash on Delivery", paymob: "Paymob", vodafone_cash: "Vodafone Cash", instapay: "InstaPay", card: "Card" };
                          return (
                            <div key={i} style={{ marginBottom: "var(--space-md)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: methodColors[method] || "var(--accent-primary-light)" }}>
                                  {methodLabels[method] || method}
                                </span>
                                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{value.toLocaleString()} EGP ({pct}%)</span>
                              </div>
                              <div style={{ height: 8, borderRadius: 4, background: "var(--bg-glass)" }}>
                                <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: methodColors[method] || "var(--accent-primary-light)", transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                              </div>
                            </div>
                          );
                        })
                      : (
                        <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No payment data yet</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>Loading revenue data...</div>
              )}
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

          {/* ═══════════════════════════════════════════════════════════════
              FEATURE 12: Customer Insights
              ═══════════════════════════════════════════════════════════════ */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="dashboard-panel-header">
              <h3>Customer Insights</h3>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {customerData ? `${customerData.totalCustomers} total customers` : "Loading..."}
              </span>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {customerData ? (
                <>
                  {/* Customer KPIs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    {[
                      { label: "Total Customers", value: customerData.totalCustomers, color: "var(--accent-primary-light)" },
                      { label: "New This Month", value: customerData.newThisMonth, color: "var(--accent-secondary)" },
                      { label: "Returning", value: customerData.returningCustomers, color: "var(--accent-green)" },
                      { label: "Avg Lifetime Value", value: `${customerData.avgLifetimeValue.toLocaleString()} EGP`, color: "var(--accent-orange)" },
                      { label: "Avg Order Value", value: `${customerData.avgOrderValue.toLocaleString()} EGP`, color: "var(--accent-primary-light)" },
                      { label: "Retention Rate", value: `${customerData.retentionRate}%`, color: customerData.retentionRate > 30 ? "var(--accent-green)" : "var(--accent-orange)" },
                    ].map((kpi, i) => (
                      <div key={i} style={{ textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{kpi.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
                    {/* New vs Returning */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        New vs Returning
                      </div>
                      <div style={{ display: "flex", height: 40, borderRadius: 12, overflow: "hidden", marginBottom: "var(--space-md)" }}>
                        <div style={{
                          width: `${customerData.newVsReturning.newPct}%`,
                          background: "var(--accent-secondary)", display: "flex", alignItems: "center",
                          justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, minWidth: 40,
                          transition: "width 0.8s ease",
                        }}>
                          {customerData.newVsReturning.newPct}%
                        </div>
                        <div style={{
                          width: `${customerData.newVsReturning.returningPct}%`,
                          background: "var(--accent-green)", display: "flex", alignItems: "center",
                          justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, minWidth: 40,
                          transition: "width 0.8s ease",
                        }}>
                          {customerData.newVsReturning.returningPct}%
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-xl)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent-secondary)" }} />
                          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>New ({customerData.newVsReturning.new})</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent-green)" }} />
                          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>Returning ({customerData.newVsReturning.returning})</span>
                        </div>
                      </div>

                      {/* Spending Segments */}
                      <div style={{ marginTop: "var(--space-xl)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Customer Segments
                        </div>
                        {Object.entries(customerData.segments).map(([segment, count], i) => {
                          const total = Object.values(customerData.segments).reduce((a, b) => a + b, 0);
                          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                          const segColors = ["var(--accent-green)", "var(--accent-primary-light)", "var(--accent-orange)", "var(--text-tertiary)"];
                          return (
                            <div key={i} style={{ marginBottom: i < 3 ? "var(--space-sm)" : 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontWeight: 500, fontSize: "var(--font-size-xs)", color: segColors[i] }}>{segment}</span>
                                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{count} ({pct}%)</span>
                              </div>
                              <div style={{ height: 5, borderRadius: 3, background: "var(--bg-glass)" }}>
                                <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: segColors[i], transition: "width 0.8s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Growth Chart + Most Active */}
                    <div>
                      {/* Customer Growth Mini-Chart */}
                      <div style={{ marginBottom: "var(--space-xl)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Customer Growth (Last 30 Days)
                        </div>
                        <div style={{ height: 60, display: "flex", alignItems: "flex-end", gap: 1 }}>
                          {customerData.customerGrowth.map((day, i) => {
                            const maxCount = Math.max(...customerData.customerGrowth.map(d => d.count), 1);
                            const pct = (day.count / maxCount) * 100;
                            return (
                              <div key={i} title={`${day.date}: ${day.count} new customers`} style={{
                                flex: 1, minHeight: day.count > 0 ? 4 : 2,
                                height: `${Math.max(pct, 3)}%`,
                                background: day.count > 0 ? "rgba(0, 210, 255, 0.5)" : "rgba(0, 210, 255, 0.08)",
                                borderRadius: "2px 2px 0 0", cursor: "default", transition: "height 0.4s ease",
                              }} />
                            );
                          })}
                        </div>
                      </div>

                      {/* Most Active Customers */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Most Active Customers
                        </div>
                        {customerData.mostActive.length === 0 ? (
                          <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-md)", fontSize: "var(--font-size-sm)" }}>No active customers yet</p>
                        ) : (
                          customerData.mostActive.slice(0, 5).map((c, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: "var(--space-sm)",
                              padding: "6px var(--space-md)", borderRadius: 10, marginBottom: 4,
                              background: i === 0 ? "rgba(108, 92, 231, 0.06)" : "transparent",
                              border: i === 0 ? "1px solid rgba(108, 92, 231, 0.15)" : "1px solid transparent",
                            }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0,
                                background: i === 0 ? "var(--accent-gradient)" : "var(--bg-glass)",
                                border: i > 0 ? "1px solid var(--border-subtle)" : "none",
                                color: i === 0 ? "white" : "var(--text-tertiary)",
                              }}>
                                {i === 0 ? "👑" : (i + 1)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "var(--font-size-xs)" }}>{c.name}</div>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{c.total_orders} orders • {c.message_count} msgs</div>
                              </div>
                              <div style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: "var(--font-size-xs)" }}>
                                {c.total_spent?.toLocaleString()} EGP
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>Loading customer insights...</div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FEATURE 13: AI Performance Metrics
              ═══════════════════════════════════════════════════════════════ */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-lg)" }}>
            <div className="dashboard-panel-header">
              <h3>AI Performance</h3>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {aiData ? `${aiData.aiPct}% AI-assisted` : "Loading..."}
              </span>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {aiData ? (
                <>
                  {/* AI Performance KPIs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    {/* AI Resolution Rate - Prominent */}
                    <div style={{ textAlign: "center", padding: "var(--space-lg)", background: "linear-gradient(135deg, rgba(0, 210, 255, 0.08), rgba(108, 92, 231, 0.08))", borderRadius: 20, border: "1px solid rgba(0, 210, 255, 0.2)" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 20, background: "rgba(0, 210, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-sm)" }}>
                        <Bot size={24} style={{ color: "var(--accent-secondary)" }} />
                      </div>
                      <div style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, color: "var(--accent-secondary)" }}>
                        {aiData.aiResolutionRate}%
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>AI Resolution Rate</div>
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>
                        {aiData.aiOnlyConvsCount} of {aiData.closedConvsCount} closed convs
                      </div>
                    </div>

                    {/* AI vs Human Messages */}
                    <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }}>Messages Sent</div>
                      <div style={{ display: "flex", height: 32, borderRadius: 10, overflow: "hidden", marginBottom: "var(--space-sm)" }}>
                        <div style={{
                          width: `${parseFloat(aiData.aiPct)}%`,
                          background: "var(--accent-secondary)", display: "flex", alignItems: "center",
                          justifyContent: "center", color: "white", fontSize: 10, fontWeight: 700,
                          transition: "width 0.8s ease", minWidth: 30,
                        }}>
                          AI
                        </div>
                        <div style={{
                          flex: 1,
                          background: "var(--accent-primary-light)", display: "flex", alignItems: "center",
                          justifyContent: "center", color: "white", fontSize: 10, fontWeight: 700,
                        }}>
                          Human
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-secondary)", fontWeight: 600 }}>
                          🤖 {aiData.totalAiMessages} AI
                        </span>
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-primary-light)", fontWeight: 600 }}>
                          👤 {aiData.totalHumanMessages} Human
                        </span>
                      </div>
                    </div>

                    {/* Response Time Comparison */}
                    <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }}>Avg Response Time</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-secondary)", fontWeight: 600 }}>🤖 AI</span>
                            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 700 }}>{formatTime(aiData.avgAiResponseTime)}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: "var(--bg-glass)" }}>
                            <div style={{
                              height: "100%", borderRadius: 4,
                              width: `${Math.min(100, aiData.avgAiResponseTime > 0 ? Math.max(5, (aiData.avgAiResponseTime / Math.max(aiData.avgHumanResponseTime, aiData.avgAiResponseTime, 1)) * 100) : 5)}%`,
                              background: "var(--accent-secondary)", transition: "width 0.8s ease",
                            }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-primary-light)", fontWeight: 600 }}>👤 Human</span>
                            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 700 }}>{formatTime(aiData.avgHumanResponseTime)}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: "var(--bg-glass)" }}>
                            <div style={{
                              height: "100%", borderRadius: 4,
                              width: `${Math.min(100, aiData.avgHumanResponseTime > 0 ? Math.max(5, (aiData.avgHumanResponseTime / Math.max(aiData.avgHumanResponseTime, aiData.avgAiResponseTime, 1)) * 100) : 5)}%`,
                              background: "var(--accent-primary-light)", transition: "width 0.8s ease",
                            }} />
                          </div>
                        </div>
                      </div>
                      {aiData.avgAiResponseTime > 0 && aiData.avgHumanResponseTime > 0 && (
                        <div style={{ fontSize: 10, color: "var(--accent-green)", marginTop: "var(--space-sm)", fontWeight: 600 }}>
                          {Math.round((1 - aiData.avgAiResponseTime / aiData.avgHumanResponseTime) * 100)}% faster with AI
                        </div>
                      )}
                    </div>

                    {/* Handoff Rate */}
                    <div style={{ textAlign: "center", padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, background: aiData.handoffRate > 30 ? "rgba(255, 82, 82, 0.12)" : "rgba(0, 230, 118, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-sm)" }}>
                        {aiData.handoffRate > 30 ? <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} /> : <Zap size={18} style={{ color: "var(--accent-green)" }} />}
                      </div>
                      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: aiData.handoffRate > 30 ? "var(--accent-red)" : "var(--accent-green)" }}>
                        {aiData.handoffRate}%
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>AI → Human Handoff</div>
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>{aiData.convsWithHandoff} conversations escalated</div>
                    </div>
                  </div>

                  {/* Sentiment + Tool Calls */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
                    {/* Sentiment Breakdown */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Customer Sentiment
                      </div>
                      {aiData.sentiment.total > 0 ? (
                        <>
                          <div style={{ display: "flex", height: 32, borderRadius: 12, overflow: "hidden", marginBottom: "var(--space-md)" }}>
                            {[
                              { pct: aiData.sentiment.positivePct, color: "var(--accent-green)", label: "Positive" },
                              { pct: aiData.sentiment.neutralPct, color: "var(--accent-secondary)", label: "Neutral" },
                              { pct: aiData.sentiment.negativePct, color: "var(--accent-orange)", label: "Negative" },
                              { pct: aiData.sentiment.urgentPct, color: "var(--accent-red)", label: "Urgent" },
                            ].filter(s => s.pct > 0).map((seg, i) => (
                              <div key={i} style={{
                                width: `${seg.pct}%`, background: seg.color, display: "flex",
                                alignItems: "center", justifyContent: "center", color: "white",
                                fontSize: 9, fontWeight: 700, minWidth: seg.pct > 8 ? 0 : 30,
                                transition: "width 0.8s ease",
                              }}>
                                {seg.pct > 8 ? `${seg.pct}%` : ""}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-sm)" }}>
                            {[
                              { label: "Positive", count: aiData.sentiment.counts.positive, pct: aiData.sentiment.positivePct, color: "var(--accent-green)", icon: <Heart size={12} /> },
                              { label: "Neutral", count: aiData.sentiment.counts.neutral, pct: aiData.sentiment.neutralPct, color: "var(--accent-secondary)", icon: <Meh size={12} /> },
                              { label: "Negative", count: aiData.sentiment.counts.negative, pct: aiData.sentiment.negativePct, color: "var(--accent-orange)", icon: <Frown size={12} /> },
                              { label: "Urgent", count: aiData.sentiment.counts.urgent, pct: aiData.sentiment.urgentPct, color: "var(--accent-red)", icon: <AlertTriangle size={12} /> },
                            ].map((s, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 8, background: "var(--bg-glass)" }}>
                                <div style={{ color: s.color }}>{s.icon}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600 }}>{s.label}</div>
                                  <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{s.count} ({s.pct}%)</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>No sentiment data yet</p>
                      )}
                    </div>

                    {/* Common AI Tool Calls */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        AI Tool Usage
                      </div>
                      {aiData.commonToolCalls.length > 0 ? (
                        aiData.commonToolCalls.map((tool, i) => {
                          const maxCount = aiData.commonToolCalls[0]?.count || 1;
                          const pct = (tool.count / maxCount) * 100;
                          const toolColors = ["var(--accent-primary-light)", "var(--accent-secondary)", "var(--accent-green)", "var(--accent-orange)", "var(--accent-red)"];
                          return (
                            <div key={i} style={{ marginBottom: i < aiData.commonToolCalls.length - 1 ? "var(--space-sm)" : 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, fontSize: "var(--font-size-xs)", textTransform: "capitalize", color: toolColors[i % toolColors.length] }}>
                                  {tool.tool.replace(/_/g, " ")}
                                </span>
                                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}>{tool.count}×</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                                <div style={{
                                  height: "100%", borderRadius: 3, width: `${pct}%`,
                                  background: toolColors[i % toolColors.length],
                                  transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>No tool call data yet</p>
                      )}
                    </div>
                  </div>

                  {/* AI Intent Distribution + Performance by Hour */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", paddingTop: "var(--space-lg)", borderTop: "1px solid var(--border-subtle)" }}>
                    {/* AI Intent Distribution */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        AI Intent Detection
                      </div>
                      {aiData.intentDistribution && aiData.intentDistribution.length > 0 ? (
                        aiData.intentDistribution.map((item, i) => {
                          const total = aiData.intentDistribution.reduce((s, x) => s + x.count, 0);
                          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                          const maxCount = aiData.intentDistribution[0]?.count || 1;
                          const barPct = (item.count / maxCount) * 100;
                          const aiIntentColors = ["#00D2FF", "#3BA55C", "#F8A532", "#ED4245", "#5865F2", "#EB459E", "#9B59B6", "#1ABC9C"];
                          return (
                            <div key={i} style={{ marginBottom: i < aiData.intentDistribution.length - 1 ? "var(--space-sm)" : 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, fontSize: "var(--font-size-xs)", textTransform: "capitalize", color: aiIntentColors[i % aiIntentColors.length] }}>
                                  {item.intent.replace(/_/g, " ")}
                                </span>
                                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", fontWeight: 600 }}>{item.count} ({pct}%)</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                                <div style={{
                                  height: "100%", borderRadius: 3, width: `${barPct}%`,
                                  background: aiIntentColors[i % aiIntentColors.length],
                                  transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>No intent data from AI yet</p>
                      )}
                    </div>

                    {/* AI Performance by Hour Heatmap */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-md)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        AI Activity by Hour
                      </div>
                      {aiData.aiPerformanceByHour ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3 }}>
                            {aiData.aiPerformanceByHour.map((h, i) => {
                              const maxMsgs = Math.max(...aiData.aiPerformanceByHour.map(x => x.messages), 1);
                              const intensity = h.messages / maxMsgs;
                              return (
                                <div key={i} title={`${h.hour}:00 — ${h.messages} AI msgs, avg ${formatTime(h.avgResponseTime)} response`} style={{
                                  height: 36, borderRadius: 6, display: "flex", flexDirection: "column",
                                  alignItems: "center", justifyContent: "flex-end",
                                  background: intensity > 0.7 ? "rgba(0, 210, 255, 0.5)" : intensity > 0.4 ? "rgba(0, 210, 255, 0.25)" : intensity > 0.1 ? "rgba(0, 210, 255, 0.1)" : "var(--bg-glass)",
                                  cursor: "default", transition: "all 0.3s",
                                  padding: "2px 0",
                                }}>
                                  {h.messages > 0 && (
                                    <div style={{ fontSize: 8, fontWeight: 700, color: intensity > 0.4 ? "white" : "var(--text-tertiary)" }}>
                                      {h.messages}
                                    </div>
                                  )}
                                  <div style={{ fontSize: 9, fontWeight: 600, color: intensity > 0.4 ? "white" : "var(--text-tertiary)", paddingBottom: 2 }}>
                                    {h.hour}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "var(--space-md)", justifyContent: "center" }}>
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Low</span>
                            {[0.1, 0.25, 0.5].map((o, i) => (
                              <div key={i} style={{ width: 16, height: 10, borderRadius: 3, background: `rgba(0, 210, 255, ${o})` }} />
                            ))}
                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>High</span>
                          </div>
                        </>
                      ) : (
                        <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)", fontSize: "var(--font-size-sm)" }}>No hourly data yet</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>Loading AI performance data...</div>
              )}
            </div>
          </div>

          {/* ═══ Bottom: Top Products + Top Customers ═══ */}
          <div className="dashboard-grid" style={{ marginBottom: "var(--space-lg)" }}>
            {/* Top Products */}
            <div className="dashboard-panel">
              <div className="dashboard-panel-header"><h3>Top Products by Revenue</h3></div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-md)" }}>
                {/* Table Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "4px var(--space-md)", marginBottom: 4 }}>
                  <div style={{ width: 28, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Product</div>
                  <div style={{ width: 60, textAlign: "right", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Qty</div>
                  <div style={{ width: 90, textAlign: "right", fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue</div>
                </div>
                {salesData && salesData.topProducts.length > 0 ? salesData.topProducts.map((p, i) => (
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
                    <div style={{ flex: 1, fontWeight: 500, fontSize: "var(--font-size-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ width: 60, textAlign: "right", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", fontWeight: 600 }}>
                      {p.quantity || "—"}
                    </div>
                    <div style={{ width: 90, textAlign: "right", fontWeight: 800, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>
                      {p.revenue.toLocaleString()} EGP
                    </div>
                  </div>
                )) : stats.topProducts.length > 0 ? stats.topProducts.map((p, i) => (
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
                    <div style={{ flex: 1, fontWeight: 500, fontSize: "var(--font-size-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ width: 90, textAlign: "right", fontWeight: 800, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>
                      {p.revenue.toLocaleString()} EGP
                    </div>
                  </div>
                )) : (
                  <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No paid orders yet</p>
                )}
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
