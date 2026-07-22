"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, Users, MessageCircle, TrendingUp, Bot,
  ArrowUpRight, ArrowDownRight, Clock, Target, Zap,
  BarChart3, DollarSign, Activity, Check, ArrowRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import InventoryAlerts from "@/app/dashboard/components/InventoryAlerts";
import AICommandCenter from "@/app/dashboard/components/AICommandCenter";
import OnboardingChecklist from "@/app/dashboard/components/OnboardingChecklist";
import AnimatedStatCard from "@/app/dashboard/components/AnimatedStatCard";
import EmptyState from "@/app/dashboard/components/EmptyState";
import SmartGreeting from "@/app/dashboard/components/SmartGreeting";
import MilestoneTracker from "@/app/dashboard/components/MilestoneTracker";
import LiveActivityFeed from "@/app/dashboard/components/LiveActivityFeed";
import QuickStatsBar from "@/app/dashboard/components/QuickStatsBar";
import Dashboard3DWidget from "@/app/dashboard/components/Dashboard3DWidget";
import PromoBanner3D from "@/app/dashboard/components/PromoBanner3D";
import { DashboardSkeleton } from "@/components/SkeletonLoader";

export default function DashboardHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const { effectiveAccountId, role } = useEffectiveAccount();

  useEffect(() => {
    if (!effectiveAccountId) return;
    const fetchStats = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const acctId = effectiveAccountId; // 🔧 Use effective account ID (owner's ID for team members)
      const isAgent = role === "agent";

      // First get user's conversation IDs (needed to filter messages)
      // For agents: only their assigned conversations
      let convsQuery = supabase
        .from("conversations")
        .select("id, status, channel, converted, created_at, assigned_to")
        .eq("account_id", acctId);
      if (isAgent) {
        convsQuery = convsQuery.eq("assigned_to", user.id);
      }
      const { data: userConvs } = await convsQuery;
      const convIds = (userConvs || []).map(c => c.id);
      const conversations = userConvs || [];

      // For agents: only their assigned customers
      let customersCountQuery = supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("account_id", acctId);
      if (isAgent) {
        customersCountQuery = customersCountQuery.eq("assigned_to", user.id);
      }

      let ordersQuery = supabase.from("orders").select("total, payment_status, created_at, status").eq("account_id", acctId);
      if (isAgent) {
        // Agent: only orders for their assigned customers
        ordersQuery = ordersQuery.in("customer_id",
          (await supabase.from("customers").select("id").eq("account_id", acctId).eq("assigned_to", user.id)).data?.map(c => c.id) || []
        );
      }

      const [
        ordersRes, customersRes, messagesRes,
        aiMsgRes, recentOrdersRes, topCustomersRes, responseTimesRes,
      ] = await Promise.all([
        ordersQuery,
        customersCountQuery,
        convIds.length > 0
          ? supabase.from("messages").select("id, created_at, direction", { count: "exact", head: true }).in("conversation_id", convIds)
          : { count: 0, data: [] },
        convIds.length > 0
          ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("is_ai", true).in("conversation_id", convIds)
          : { count: 0, data: [] },
        supabase.from("orders").select("*, customer:customers(name)").eq("account_id", acctId).order("created_at", { ascending: false }).limit(5),
        isAgent
          ? supabase.from("customers").select("name, total_orders, total_spent, channel, platform").eq("account_id", acctId).eq("assigned_to", user.id).order("total_spent", { ascending: false }).limit(5)
          : supabase.from("customers").select("name, total_orders, total_spent, channel, platform").eq("account_id", acctId).order("total_spent", { ascending: false }).limit(5),
        convIds.length > 0
          ? supabase.from("messages").select("response_time_seconds").in("conversation_id", convIds).not("response_time_seconds", "is", null).limit(100)
          : { data: [] },
      ]);

      const convertedCount = conversations.filter(c => c.converted).length;
      const activeConvsCount = conversations.filter(c => ["new", "open", "in_progress"].includes(c.status)).length;
      const orders = ordersRes.data || [];
      const totalMessages = messagesRes.count || 0;
      const aiMessages = aiMsgRes.count || 0;
      const totalConvs = conversations.length;
      const revenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (o.total || 0), 0);
      const pendingRevenue = orders.filter(o => o.payment_status !== "paid" && o.status !== "cancelled").reduce((sum, o) => sum + (o.total || 0), 0);

      // Conversion rate
      const conversionRate = totalConvs > 0 ? Math.round((convertedCount / totalConvs) * 100) : 0;

      // Avg response time
      const responseTimes = (responseTimesRes.data || []).map(r => r.response_time_seconds).filter(Boolean);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Channel distribution
      const igCount = conversations.filter(c => c.channel === "instagram").length;
      const fbCount = conversations.filter(c => c.channel === "facebook").length;
      const waCount = conversations.filter(c => c.channel === "whatsapp").length;

      // AI resolution rate
      const aiPct = totalMessages > 0 ? Math.round((aiMessages / totalMessages) * 100) : 0;

      // Orders by status
      const ordersByStatus = {
        pending: orders.filter(o => o.status === "pending").length,
        confirmed: orders.filter(o => o.status === "confirmed").length,
        shipped: orders.filter(o => o.status === "shipped").length,
        delivered: orders.filter(o => o.status === "delivered").length,
      };

      setStats({
        revenue,
        pendingRevenue,
        totalOrders: orders.length,
        totalCustomers: customersRes.count || 0,
        totalProducts: 0, // will be fetched separately if needed
        totalConversations: totalConvs,
        activeConversations: activeConvsCount,
        totalMessages,
        aiMessages,
        aiPct,
        conversionRate,
        convertedCount,
        avgResponseTime,
        igCount, fbCount, waCount,
        ordersByStatus,
        recentOrders: recentOrdersRes.data || [],
        topCustomers: topCustomersRes.data || [],
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading || !stats) {
    return <DashboardSkeleton />;
  }

  const formatResponseTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const statusColors = {
    pending: "var(--accent-orange)", confirmed: "var(--accent-primary-light)",
    shipped: "var(--accent-secondary)", delivered: "var(--accent-green)", cancelled: "var(--accent-red)",
  };

  return (
    <>
      <OnboardingChecklist />
      <MilestoneTracker stats={stats} />
      <SmartGreeting user={user} stats={stats} />
      {stats && stats.totalMessages > 0 && <AICommandCenter />}
      {stats && stats.totalMessages > 0 && <QuickStatsBar stats={stats} />}
      {stats.totalMessages === 0 && stats.totalOrders === 0 ? (
        <div style={{ marginTop: "var(--space-2xl)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-2xl)" }}>
            <img src="/logo.png" alt="Sellora" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: "var(--space-md)" }} />
            <h1 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: "var(--space-xs)" }}>Welcome to Sellora</h1>
            <p style={{ color: "var(--text-tertiary)" }}>Your store is set up! Here are your next steps to start automating sales.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", background: "var(--bg-card)", padding: "var(--space-xl)", borderRadius: 24, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0, 230, 118, 0.1)", color: "var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Create your account</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>You're all set here.</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ width: 32, height: 32, border: "2px solid var(--border-medium)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Connect more channels</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Link your Instagram or Facebook to start receiving messages.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard/settings?tab=channels')}>Connect</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ width: 32, height: 32, border: "2px solid var(--border-medium)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>3</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Add 3 products</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Help the AI understand your catalog.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard/products')}>Add Products</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
              <div style={{ width: 32, height: 32, border: "2px dashed var(--border-medium)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>4</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Receive your first message</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Have a customer (or yourself) send a DM to test it out.</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/dashboard/conversations')}>Go to Inbox <ArrowRight size={14} style={{ marginLeft: 4 }} /></button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ═══ 3D Revenue Widget ═══ */}
          <div style={{ marginBottom: "var(--space-lg)" }}>
            <Dashboard3DWidget
              statValue={`${(stats.revenue || 0).toLocaleString()} EGP`}
              statLabel="Total Revenue"
              color="#6c5ce7"
            />
          </div>

          {/* ═══ 3D Promo Banner ═══ */}
          {stats.totalOrders < 10 && (
            <div style={{ marginBottom: "var(--space-lg)" }}>
              <PromoBanner3D
                title="Upgrade to Pro"
                subtitle="Unlock unlimited AI replies + advanced automations"
                color="#6c5ce7"
                ribbonColor="#f8a532"
                height={140}
              />
            </div>
          )}

          {/* ═══ Key Metrics Row ═══ */}
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-md)" }}>
            <div style={{ gridColumn: "span 2" }}>
              <AnimatedStatCard
                label="Total Revenue"
                value={stats.revenue}
                formatFn={(v) => `${v.toLocaleString()} EGP`}
                icon={DollarSign}
                color="#3BA55C"
                trend={stats.pendingRevenue > 0 ? 12 : 0}
              />
              {stats.pendingRevenue > 0 && (
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-orange)", marginTop: 4 }}>
                  +{stats.pendingRevenue.toLocaleString()} EGP pending
                </div>
              )}
            </div>

            <AnimatedStatCard
              label="Conversion Rate"
              value={stats.conversionRate}
              formatFn={(v) => `${v}%`}
              icon={Target}
              color="#5865F2"
            />

            <AnimatedStatCard
              label="Avg Response"
              value={stats.avgResponseTime}
              formatFn={(v) => v > 0 ? formatResponseTime(v) : "—"}
              icon={Clock}
              color="#00D2FF"
            />

            <AnimatedStatCard
              label="Active Chats"
              value={stats.activeConversations}
              icon={Activity}
              color="#F8A532"
            />

            <AnimatedStatCard
              label="Total Orders"
              value={stats.totalOrders}
              icon={ShoppingBag}
              color="#3BA55C"
            />

            <AnimatedStatCard
              label="AI Resolution"
              value={stats.aiPct}
              formatFn={(v) => `${v}%`}
              icon={Bot}
              color="#00D2FF"
            />
          </div>

      {/* ═══ Inventory Alerts ═══ */}
      <InventoryAlerts />

      {/* ═══ Live Activity Feed ═══ */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <LiveActivityFeed limit={8} />
      </div>

      {/* ═══ Middle Row: Order Pipeline + Channel Split ═══ */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Order Pipeline */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Order Pipeline</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", gap: "var(--space-md)" }}>
              {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                <div key={status} style={{ flex: 1, textAlign: "center", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: statusColors[status] }}>{count}</div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "capitalize", marginTop: 2 }}>{status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Channels</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
            {[
              { name: "Instagram", count: stats.igCount, color: "#E1306C", total: stats.totalConversations },
              { name: "Facebook", count: stats.fbCount, color: "#1877F2", total: stats.totalConversations },
              { name: "WhatsApp", count: stats.waCount, color: "var(--accent-green)", total: stats.totalConversations },
            ].map((ch, i) => {
              const pct = ch.total > 0 ? Math.round((ch.count / ch.total) * 100) : 0;
              return (
                <div key={i} style={{ marginBottom: i < 2 ? "var(--space-md)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{ch.name}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{ch.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: ch.color, transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Bottom Row: Recent Orders + Top Customers ═══ */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        {/* Recent Orders */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Recent Orders</h3></div>
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            <div className="table-scroll-wrapper"><table className="data-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {stats.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{order.order_number}</td>
                    <td>{order.customer?.name || "Unknown"}</td>
                    <td style={{ fontWeight: 700 }}>{order.total?.toLocaleString()} EGP</td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: `${statusColors[order.status]}22`, color: statusColors[order.status],
                      }}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.recentOrders.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: "center", padding: "var(--space-xl)", color: "var(--text-tertiary)" }}>No orders yet</td></tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header"><h3>Top Customers</h3></div>
          <div className="dashboard-panel-body" style={{ padding: "var(--space-md)" }}>
            {stats.topCustomers.map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "var(--space-sm) var(--space-md)",
                borderRadius: 12, marginBottom: 4,
                background: i === 0 ? "rgba(88, 101, 242, 0.06)" : "transparent",
                border: i === 0 ? "1px solid rgba(88, 101, 242, 0.15)" : "1px solid transparent",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: i === 0 ? "var(--accent-gradient)" : "var(--bg-glass)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
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
            {stats.topCustomers.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No customers yet</p>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </>
  );
}
