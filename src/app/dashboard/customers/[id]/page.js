"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffectiveAccount } from "@/lib/account-context";
import {
  ArrowLeft, Phone, Mail, MessageCircle, ShoppingBag, Star,
  Crown, Clock, Tag, Bot, User, Loader2,
} from "lucide-react";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id;
  const { effectiveAccountId } = useEffectiveAccount();

  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const accId = effectiveAccountId || user.id;
      const [custRes, ordersRes, convsRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).eq("account_id", accId).single(),
        supabase.from("orders").select("*").eq("customer_id", customerId).eq("account_id", accId).order("created_at", { ascending: false }),
        supabase.from("conversations").select("id, channel, status, last_message_at, created_at").eq("customer_id", customerId).eq("account_id", accId).order("created_at", { ascending: false }),
      ]);

      if (custRes.data) setCustomer(custRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (convsRes.data) setConversations(convsRes.data);
      setLoading(false);
    };
    load();
  }, [customerId, effectiveAccountId]);

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Customer not found</div>;
  }

  const totalSpent = orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total || 0), 0);
  const paidOrders = orders.filter(o => o.payment_status === "paid");

  return (
    <div style={{ padding: "var(--space-xl)", maxWidth: 900, margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/customers")}
        style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 14 }}
      >
        <ArrowLeft size={16} /> Back to Customers
      </button>

      {/* Header card */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-medium)",
        borderRadius: 16, padding: 24, marginBottom: 20, display: "flex", gap: 20, alignItems: "center",
      }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, #5865F2, #00D2FF)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>
          {customer.name?.charAt(0).toUpperCase() || "?"}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{customer.name}</h1>
            {customer.vip && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(245,180,0,0.15)", color: "#f5b400" }}>
                <Crown size={12} /> VIP
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
            {customer.phone && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-tertiary)" }}><Phone size={13} /> {customer.phone}</span>}
            {customer.email && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-tertiary)" }}><Mail size={13} /> {customer.email}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text-tertiary)" }}><MessageCircle size={13} /> {customer.channel}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Total Orders" value={customer.total_orders || orders.length} icon={ShoppingBag} color="#5865F2" />
        <StatBox label="Total Spent" value={`${totalSpent.toLocaleString()} EGP`} icon={Tag} color="#3BA55C" />
        <StatBox label="Lifetime Value" value={`${Number(customer.lifetime_value || totalSpent).toLocaleString()} EGP`} icon={Crown} color="#F8A532" />
        <StatBox label="Customer Since" value={new Date(customer.created_at).toLocaleDateString()} icon={Clock} color="#00D2FF" />
      </div>

      {/* Two columns: Orders + AI Memory */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Order History */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingBag size={18} /> Order History ({orders.length})
          </h3>
          {orders.length === 0 ? (
            <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No orders yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.slice(0, 10).map(order => (
                <div key={order.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{order.order_number}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {new Date(order.created_at).toLocaleDateString()} · {order.items?.length || 0} items
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{Number(order.total).toLocaleString()} {order.currency}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                      background: order.payment_status === "paid" ? "rgba(59,165,92,0.15)" : "rgba(248,165,50,0.15)",
                      color: order.payment_status === "paid" ? "#3BA55C" : "#F8A532",
                    }}>
                      {order.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Memory + Preferences */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={18} /> AI Memory & Preferences
          </h3>

          {/* Preferences */}
          {customer.preferences && Object.keys(customer.preferences).length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Stored Preferences</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(customer.preferences).map(([key, value]) => (
                  <span key={key} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, background: "rgba(88,101,242,0.1)", color: "var(--accent-primary-light)", border: "1px solid rgba(88,101,242,0.2)" }}>
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>No preferences stored yet. The AI will learn these during conversations.</p>
          )}

          {/* AI Memory Notes */}
          {customer.ai_memory && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>AI Memory Notes</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                {customer.ai_memory}
              </div>
            </div>
          )}

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Tags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {customer.tags.map((tag, i) => (
                  <span key={i} style={{ padding: "3px 10px", borderRadius: 8, fontSize: 12, background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversations */}
      {conversations.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: 20, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} /> Conversations ({conversations.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => router.push("/dashboard/conversations")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  textAlign: "left", color: "var(--text-primary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MessageCircle size={14} color="var(--accent-primary)" />
                  <span style={{ fontSize: 13 }}>{conv.channel} · {conv.status}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : "—"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-medium)",
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color={color} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
