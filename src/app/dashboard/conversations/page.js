"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, Send, Search, Bot, Phone, MoreVertical,
  FlaskConical, Package, ShoppingBag, Tag, X, Plus, Minus,
  ChevronRight, Camera, Globe, Clock, User, Mail,
  MapPin, Hash, Star, ArrowRight, Check, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

// ─── Intent badge config ───
const INTENT_CONFIG = {
  price_inquiry: { label: "💰 Price", color: "var(--accent-orange)" },
  order: { label: "🛒 Order", color: "var(--accent-green)" },
  order_status: { label: "📦 Status", color: "var(--accent-secondary)" },
  product_info: { label: "📋 Product", color: "var(--accent-primary-light)" },
  complaint: { label: "⚠️ Complaint", color: "var(--accent-red)" },
  return: { label: "↩️ Return", color: "var(--accent-pink)" },
  general: { label: "💬 General", color: "var(--text-tertiary)" },
};

const CHANNEL_ICON = {
  instagram: <Camera size={14} />,
  facebook: <Globe size={14} />,
  whatsapp: <Phone size={14} />,
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "var(--accent-secondary)" },
  { value: "in_progress", label: "In Progress", color: "var(--accent-primary-light)" },
  { value: "waiting_customer", label: "Waiting", color: "var(--accent-orange)" },
  { value: "closed", label: "Closed", color: "var(--text-tertiary)" },
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Right panel
  const [customerInfo, setCustomerInfo] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Quick actions
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  // Order creation
  const [orderItems, setOrderItems] = useState([]);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState("cod");
  const [orderAddress, setOrderAddress] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [sendPaymentLink, setSendPaymentLink] = useState(false);

  // Simulator
  const [simulatorMode, setSimulatorMode] = useState(false);
  const [simInput, setSimInput] = useState("");
  const [simMessages, setSimMessages] = useState([]);
  const [simLoading, setSimLoading] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountPlan, setAccountPlan] = useState("starter");

  const messagesEndRef = useRef(null);
  const simulatorEndRef = useRef(null);
  const supabase = createClient();

  // ─── Fetch conversations ───
  const fetchConversations = useCallback(async () => {
    // Fetch account plan for data retention
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: acct } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (acct?.plan) setAccountPlan(acct.plan);
    }

    const { data } = await supabase
      .from("conversations")
      .select("*, customer:customers(id, name, phone, channel, platform, platform_id, tags, total_orders, total_spent, profile_pic_url, is_returning)")
      .order("last_message_at", { ascending: false });

    if (data) {
      const convsWithLastMsg = await Promise.all(
        data.map(async (conv) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("content, created_at, direction, is_ai, intent")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return { ...conv, lastMessage: msgs?.[0] || null };
        })
      );
      setConversations(convsWithLastMsg);
      if (!activeConv && convsWithLastMsg.length > 0) {
        setActiveConv(convsWithLastMsg[0]);
      }
    }
    setLoading(false);
  }, []);

  // ─── Fetch messages (with data retention) ───
  const fetchMessages = useCallback(async () => {
    if (!activeConv) return;

    // Apply data retention filter based on plan
    const planLimits = getPlanLimits(accountPlan);
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeConv.id)
      .order("created_at", { ascending: true });

    // Apply retention limit if not unlimited
    if (planLimits.data_retention_days !== -1) {
      const cutoff = new Date(Date.now() - planLimits.data_retention_days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", cutoff);
    }

    const { data } = await query;
    if (data) setMessages(data);

    if (activeConv.unread_count > 0) {
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", activeConv.id);
    }
  }, [activeConv]);

  // ─── Fetch customer details ───
  const fetchCustomerInfo = useCallback(async () => {
    if (!activeConv?.customer?.id) return;
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", activeConv.customer.id)
      .single();
    setCustomerInfo(customer);

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", activeConv.customer.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setCustomerOrders(orders || []);
  }, [activeConv]);

  // ─── Fetch products for picker ───
  const fetchProducts = useCallback(async () => {
    let query = supabase.from("products").select("*").eq("status", "active").order("name");
    if (productSearch) query = query.ilike("name", `%${productSearch}%`);
    const { data } = await query;
    setProducts(data || []);
  }, [productSearch]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { fetchCustomerInfo(); }, [fetchCustomerInfo]);
  useEffect(() => { if (showProductPicker || showOrderModal) fetchProducts(); }, [showProductPicker, showOrderModal, fetchProducts]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { simulatorEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [simMessages]);

  // ─── Real-time subscription ───
  useEffect(() => {
    if (!activeConv) return;
    const channel = supabase
      .channel(`messages:${activeConv.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv]);

  // ─── Send message ───
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeConv || sending) return;
    setSending(true);

    try {
      // Send via Meta API (Facebook/Instagram) if the conversation is on a real channel
      if (activeConv.channel === "instagram" || activeConv.channel === "facebook") {
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConv.id,
            content: newMsg.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("Failed to send message to Meta:", data.error);
          // Still save locally even if Meta delivery fails
          await supabase.from("messages").insert({
            conversation_id: activeConv.id,
            direction: "outgoing",
            content: newMsg.trim(),
            type: "text",
            is_ai: false,
          });
        }
      } else {
        // For other channels (or no channel), just save locally
        await supabase.from("messages").insert({
          conversation_id: activeConv.id,
          direction: "outgoing",
          content: newMsg.trim(),
          type: "text",
          is_ai: false,
        });
      }

      await supabase.from("conversations")
        .update({ last_message_at: new Date().toISOString(), status: "waiting_customer" })
        .eq("id", activeConv.id);

      setNewMsg("");
      await fetchMessages();
      await fetchConversations();
    } catch (err) {
      console.error("Send error:", err);
    }
    setSending(false);
  };

  // ─── Update conversation status ───
  const updateConvStatus = async (status) => {
    if (!activeConv) return;
    const updates = { status };
    if (status === "closed") updates.resolved_at = new Date().toISOString();
    await supabase.from("conversations").update(updates).eq("id", activeConv.id);
    setActiveConv((prev) => ({ ...prev, status }));
    fetchConversations();
  };

  // ─── Send product card into chat ───
  const handleSendProduct = async (product) => {
    if (!activeConv) return;
    const content = `📦 ${product.name}\n💰 ${product.price} EGP\n${product.description || ""}`;

    try {
      // Send via Meta API for Facebook/Instagram channels
      if (activeConv.channel === "instagram" || activeConv.channel === "facebook") {
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConv.id,
            content,
            type: "product_card",
            product: {
              name: product.name,
              price: product.price,
              currency: "EGP",
              description: product.description || "",
              image_urls: product.image_urls || [],
              id: product.id,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("Failed to send product card to Meta:", data.error);
          // Fallback: save locally even if Meta delivery fails
          await supabase.from("messages").insert({
            conversation_id: activeConv.id,
            direction: "outgoing",
            content,
            type: "product_card",
            is_ai: false,
          });
        }
      } else {
        // For other channels, just save locally
        await supabase.from("messages").insert({
          conversation_id: activeConv.id,
          direction: "outgoing",
          content,
          type: "product_card",
          is_ai: false,
        });
      }

      // Update conversation timestamp
      await supabase.from("conversations")
        .update({ last_message_at: new Date().toISOString(), status: "waiting_customer" })
        .eq("id", activeConv.id);
    } catch (err) {
      console.error("Send product error:", err);
      // Fallback: save locally
      await supabase.from("messages").insert({
        conversation_id: activeConv.id,
        direction: "outgoing",
        content,
        type: "product_card",
        is_ai: false,
      });
    }

    setShowProductPicker(false);
    fetchMessages();
    fetchConversations();
  };

  // ─── Create order from chat ───
  const handleCreateOrder = async () => {
    if (orderItems.length === 0 || !activeConv) return;
    setOrderSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const subtotal = orderItems.reduce((s, item) => s + item.price * item.qty, 0);

    const { data: orderData, error } = await supabase.from("orders").insert({
      account_id: user.id,
      customer_id: activeConv.customer.id,
      conversation_id: activeConv.id,
      items: orderItems.map((i) => ({ name: i.name, qty: i.qty, price: i.price, product_id: i.id })),
      subtotal,
      total: subtotal,
      status: "pending",
      payment_method: orderPaymentMethod,
      shipping_address: orderAddress,
      channel: activeConv.channel || "instagram",
      source: "chat",
    }).select("id, order_number").single();

    if (!error && orderData) {
      // Build confirmation message
      const itemsList = orderItems.map((i) => `${i.qty}x ${i.name}`).join(", ");
      let confirmationContent = `✅ Order created!\n\nItems: ${itemsList}\nTotal: ${subtotal} EGP\nPayment: ${orderPaymentMethod === "paymob" ? "Online Payment" : orderPaymentMethod.toUpperCase()}`;

      // Generate Paymob payment link if requested
      let paymentUrl = null;
      if (sendPaymentLink || orderPaymentMethod === "paymob") {
        try {
          const paymobRes = await fetch("/api/paymob/order-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: orderData.id }),
          });
          const paymobData = await paymobRes.json();

          if (paymobRes.ok && paymobData.paymentLink) {
            paymentUrl = paymobData.paymentLink;
            confirmationContent += `\n\n💳 Pay now: ${paymentUrl}`;
          } else {
            console.error("Failed to generate Paymob link:", paymobData.error);
          }
        } catch (err) {
          console.error("Paymob checkout error:", err);
        }
      }

      confirmationContent += "\n\nWe'll confirm your order shortly!";

      // Send confirmation via Meta API for Facebook/Instagram channels
      try {
        if (activeConv.channel === "instagram" || activeConv.channel === "facebook") {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: activeConv.id,
              content: confirmationContent,
              type: "text",
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            console.error("Failed to send order confirmation to Meta:", data.error);
            // Fallback: save locally
            await supabase.from("messages").insert({
              conversation_id: activeConv.id,
              direction: "outgoing",
              content: confirmationContent,
              type: "text",
              is_ai: false,
            });
          }
        } else {
          // For other channels, just save locally
          await supabase.from("messages").insert({
            conversation_id: activeConv.id,
            direction: "outgoing",
            content: confirmationContent,
            type: "text",
            is_ai: false,
          });
        }
      } catch (err) {
        console.error("Send order confirmation error:", err);
        // Fallback: save locally
        await supabase.from("messages").insert({
          conversation_id: activeConv.id,
          direction: "outgoing",
          content: confirmationContent,
          type: "text",
          is_ai: false,
        });
      }

      setShowOrderModal(false);
      setOrderItems([]);
      setOrderAddress("");
      setSendPaymentLink(false);
      fetchMessages();
      fetchCustomerInfo();
      fetchConversations();
    }
    setOrderSaving(false);
  };

  // ─── Simulator ───
  const handleSimSubmit = async () => {
    if (!simInput?.trim() || simLoading) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: simInput };
    setSimMessages((prev) => [...prev, userMsg]);
    setSimInput("");
    setSimLoading(true);

    try {
      const resp = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...simMessages, userMsg] }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Simulation failed");
      setSimMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.content }]);
    } catch (error) {
      setSimMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `⚠️ Simulator Error: ${error.message}` }]);
    } finally {
      setSimLoading(false);
    }
  };

  // ─── Helpers ───
  const formatTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const formatRelative = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };
  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // ─── Filter conversations ───
  const filteredConvs = conversations.filter((c) => {
    if (search && !c.customer?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const statusColor = STATUS_OPTIONS.find((s) => s.value === activeConv?.status)?.color || "var(--text-tertiary)";

  return (
    <div className="conversations-layout" style={{ gridTemplateColumns: showInfoPanel && activeConv && !simulatorMode ? "300px 1fr 320px" : "300px 1fr" }}>

      {/* ═══════ LEFT PANEL: Conversation List ═══════ */}
      <div className="conv-list">
        <div className="conv-list-header">
          <h2>Messages</h2>
          <input type="text" className="conv-search" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} />

          {/* Status filter tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  background: statusFilter === s.value ? "var(--accent-primary)" : "var(--bg-glass)",
                  color: statusFilter === s.value ? "white" : "var(--text-secondary)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Simulator toggle */}
          <button
            className={`btn ${simulatorMode ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setSimulatorMode(!simulatorMode); if (!simulatorMode) setActiveConv(null); }}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            <FlaskConical size={16} /> {simulatorMode ? "Exit Simulator" : "AI Simulator"}
          </button>
        </div>

        <div className="conv-items">
          {loading ? (
            <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>Loading...</div>
          ) : filteredConvs.length === 0 ? (
            <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>No conversations found</div>
          ) : filteredConvs.map((conv) => (
            <div
              key={conv.id}
              className={`conv-item ${activeConv?.id === conv.id ? "active" : ""}`}
              onClick={() => { setActiveConv(conv); setSimulatorMode(false); }}
            >
              {/* Avatar */}
              <div className="conv-avatar" style={{ background: conv.customer?.profile_pic_url ? "transparent" : "var(--accent-gradient)", position: "relative" }}>
                {conv.customer?.profile_pic_url ? (
                  <img src={conv.customer.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  conv.customer?.name?.split(" ").map(n => n[0]).join("") || "?"
                )}
                {/* Channel indicator */}
                <span style={{
                  position: "absolute", bottom: -2, right: -2, width: 18, height: 18,
                  borderRadius: "50%", background: "var(--bg-secondary)", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 10,
                  border: "2px solid var(--bg-primary)",
                }}>
                  {CHANNEL_ICON[conv.channel] || CHANNEL_ICON.instagram}
                </span>
              </div>

              <div className="conv-info">
                <div className="conv-info-top">
                  <span className="conv-name" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {conv.customer?.name || "Unknown"}
                    {conv.customer?.is_returning && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(88,101,242,0.15)", color: "var(--accent-primary-light)" }}>↩</span>}
                  </span>
                  <span className="conv-time">{formatRelative(conv.last_message_at)}</span>
                </div>
                <div className="conv-preview" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {conv.lastMessage?.is_ai && <Bot size={11} style={{ color: "var(--accent-secondary)", flexShrink: 0 }} />}
                  {conv.lastMessage?.intent && conv.lastMessage.intent !== "general" && (
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: INTENT_CONFIG[conv.lastMessage.intent]?.color + "22", color: INTENT_CONFIG[conv.lastMessage.intent]?.color, flexShrink: 0 }}>
                      {INTENT_CONFIG[conv.lastMessage.intent]?.label}
                    </span>
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {conv.lastMessage?.content?.slice(0, 45) || "No messages yet"}
                  </span>
                </div>
                {/* Status dot */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: STATUS_OPTIONS.find(s => s.value === conv.status)?.color || "var(--text-tertiary)",
                  }} />
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{STATUS_OPTIONS.find(s => s.value === conv.status)?.label || conv.status}</span>
                </div>
              </div>

              {conv.unread_count > 0 && (
                <span className="conv-unread">{conv.unread_count}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ CENTER PANEL: Chat Area ═══════ */}
      <div className="chat-area">
        {simulatorMode ? (
          <>
            <div className="chat-header" style={{ background: "rgba(88, 101, 242, 0.05)", borderBottomColor: "var(--accent-primary)" }}>
              <div className="chat-header-info">
                <div className="conv-avatar" style={{ background: "var(--accent-gradient)", color: "white" }}><Bot size={20} /></div>
                <div>
                  <div className="chat-header-name">AI Simulator Mode</div>
                  <div className="chat-header-status" style={{ color: "var(--accent-primary-light)" }}>Testing your product catalog</div>
                </div>
              </div>
            </div>
            <div className="chat-messages">
              <div className="chat-msg ai-reply"><span className="ai-label"><Bot size={12} /> Sellora AI</span><div className="msg-bubble">Hi! Ask me about your inventory, prices, or try to buy something!</div></div>
              {simMessages.map((msg) => (
                <div key={msg.id} className={`chat-msg ${msg.role === "user" ? "outgoing" : "ai-reply"}`}>
                  {msg.role !== "user" && <span className="ai-label"><Bot size={12} /> Sellora AI</span>}
                  <div className="msg-bubble">{msg.content}</div>
                </div>
              ))}
              {simLoading && <div className="chat-msg ai-reply"><div className="msg-bubble" style={{ opacity: 0.7 }}>•••</div></div>}
              <div ref={simulatorEndRef} />
            </div>
            <div className="chat-input-area">
              <div className="chat-input-wrapper">
                <input type="text" placeholder="Test a customer message..." className="chat-input" value={simInput || ""} onChange={(e) => setSimInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSimSubmit())} disabled={simLoading} />
                <button type="button" className="chat-send-btn" onClick={handleSimSubmit} disabled={!(simInput || "").trim() || simLoading}><Send size={18} /></button>
              </div>
            </div>
          </>
        ) : activeConv ? (
          <>
            {/* ── Chat Header ── */}
            <div className="chat-header" style={{ flexShrink: 0 }}>
              <div className="chat-header-info">
                <div className="conv-avatar" style={{ width: 38, height: 38, fontSize: 12, background: activeConv.customer?.profile_pic_url ? "transparent" : "var(--accent-gradient)" }}>
                  {activeConv.customer?.profile_pic_url ? (
                    <img src={activeConv.customer.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    activeConv.customer?.name?.split(" ").map(n => n[0]).join("")
                  )}
                </div>
                <div>
                  <div className="chat-header-name">{activeConv.customer?.name}</div>
                  <div className="chat-header-status" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {CHANNEL_ICON[activeConv.channel]} {activeConv.channel === "instagram" ? "Instagram" : activeConv.channel === "facebook" ? "Facebook" : "WhatsApp"}
                    <span style={{ color: "var(--text-tertiary)" }}>•</span>
                    {activeConv.customer?.phone || activeConv.customer?.platform_id?.slice(0, 8) + "..."}
                  </div>
                </div>
              </div>
              <div className="chat-header-actions" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* Status selector */}
                <select
                  value={activeConv.status || "new"}
                  onChange={(e) => updateConvStatus(e.target.value)}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${statusColor}33`, background: `${statusColor}15`,
                    color: statusColor, cursor: "pointer", outline: "none",
                    fontFamily: "var(--font-family)",
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value} style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>{s.label}</option>
                  ))}
                </select>
                <button className="topbar-btn" title="Toggle info panel" onClick={() => setShowInfoPanel(!showInfoPanel)}>
                  <User size={16} />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="chat-messages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-msg ${msg.direction === "incoming" ? "incoming" : msg.is_ai ? "ai-reply" : "outgoing"}`}
                >
                  {msg.is_ai && <span className="ai-label"><Bot size={10} /> AI Auto-Reply</span>}
                  {msg.intent && msg.intent !== "general" && msg.direction === "incoming" && (
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 8, marginBottom: 4, display: "inline-block",
                      background: INTENT_CONFIG[msg.intent]?.color + "22",
                      color: INTENT_CONFIG[msg.intent]?.color,
                    }}>
                      {INTENT_CONFIG[msg.intent]?.label}
                    </span>
                  )}
                  {msg.type === "product_card" ? (
                    <div className="msg-bubble" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: "var(--space-md)" }}>
                      <div style={{ whiteSpace: "pre-line" }}>{msg.content}</div>
                    </div>
                  ) : (
                    <>{msg.content}</>
                  )}
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Actions Bar ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderTop: "1px solid var(--border-subtle)", background: "var(--bg-secondary)",
              flexShrink: 0,
            }}>
              <button onClick={() => setShowProductPicker(true)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-subtle)",
                background: "var(--bg-glass)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}>
                <Package size={13} /> Send Product
              </button>
              <button onClick={() => { setShowOrderModal(true); setOrderItems([]); }} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-subtle)",
                background: "var(--bg-glass)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}>
                <ShoppingBag size={13} /> Create Order
              </button>
              <button onClick={() => updateConvStatus("closed")} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-subtle)",
                background: "var(--bg-glass)", color: "var(--text-tertiary)", cursor: "pointer", marginLeft: "auto",
              }}>
                Close
              </button>
            </div>

            {/* ── Input ── */}
            <form className="chat-input-area" onSubmit={handleSend}>
              <input type="text" className="chat-input" placeholder="Type a message..." value={newMsg} onChange={(e) => setNewMsg(e.target.value)} id="chat-message-input" />
              <button type="submit" className="chat-send-btn" disabled={!newMsg.trim() || sending} id="chat-send"><Send size={18} /></button>
            </form>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
            <div style={{ textAlign: "center" }}>
              <MessageCircle size={48} style={{ marginBottom: "var(--space-md)", opacity: 0.3 }} />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ RIGHT PANEL: Customer Info ═══════ */}
      {showInfoPanel && activeConv && !simulatorMode && (
        <div style={{
          borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-secondary)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Customer header */}
          <div style={{ padding: "var(--space-lg)", borderBottom: "1px solid var(--border-subtle)", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: customerInfo?.profile_pic_url ? "transparent" : "var(--accent-gradient)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, margin: "0 auto var(--space-sm)",
            }}>
              {customerInfo?.profile_pic_url ? (
                <img src={customerInfo.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                customerInfo?.name?.split(" ").map(n => n[0]).join("") || "?"
              )}
            </div>
            <div style={{ fontWeight: 700 }}>{customerInfo?.name || "Unknown"}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 }}>
              {CHANNEL_ICON[customerInfo?.platform || customerInfo?.channel]}
              {customerInfo?.platform || customerInfo?.channel}
              {customerInfo?.is_returning && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "rgba(59,165,92,0.15)", color: "var(--accent-green)" }}>Returning</span>}
            </div>
          </div>

          {/* Customer stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ padding: "var(--space-md)", textAlign: "center", borderRight: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--accent-primary-light)" }}>{customerInfo?.total_orders || 0}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Orders</div>
            </div>
            <div style={{ padding: "var(--space-md)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--accent-green)" }}>{customerInfo?.total_spent?.toLocaleString() || 0}</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>EGP Spent</div>
            </div>
          </div>

          {/* Customer details */}
          <div style={{ padding: "var(--space-md)", flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>Details</div>

            {customerInfo?.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "var(--font-size-sm)" }}>
                <Phone size={13} style={{ color: "var(--text-tertiary)" }} /> {customerInfo.phone}
              </div>
            )}
            {customerInfo?.email && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "var(--font-size-sm)" }}>
                <Mail size={13} style={{ color: "var(--text-tertiary)" }} /> {customerInfo.email}
              </div>
            )}
            {customerInfo?.address && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "var(--font-size-sm)" }}>
                <MapPin size={13} style={{ color: "var(--text-tertiary)" }} /> {customerInfo.address}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "var(--font-size-sm)" }}>
              <Hash size={13} style={{ color: "var(--text-tertiary)" }} /> {customerInfo?.platform_id?.slice(0, 16) || "N/A"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: "var(--font-size-sm)" }}>
              <Clock size={13} style={{ color: "var(--text-tertiary)" }} /> Joined {customerInfo?.first_seen_at ? formatDate(customerInfo.first_seen_at) : formatDate(customerInfo?.created_at)}
            </div>

            {/* Tags */}
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)", marginTop: "var(--space-md)" }}>Tags</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: "var(--space-md)" }}>
              {(customerInfo?.tags || []).map((tag, i) => (
                <span key={i} style={{
                  padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                  background: tag === "VIP" ? "rgba(88,101,242,0.15)" : "var(--bg-glass)",
                  color: tag === "VIP" ? "var(--accent-primary-light)" : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}>{tag}</span>
              ))}
              {(!customerInfo?.tags || customerInfo.tags.length === 0) && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No tags</span>
              )}
            </div>

            {/* Recent orders */}
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--space-sm)" }}>Recent Orders</div>
            {customerOrders.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No orders yet</p>
            ) : customerOrders.map((order) => (
              <div key={order.id} style={{
                padding: "var(--space-sm) var(--space-md)", background: "var(--bg-glass)",
                borderRadius: 10, marginBottom: 6, border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{order.order_number}</span>
                  <span style={{ fontWeight: 700 }}>{order.total} EGP</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {order.status} • {formatDate(order.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowProductPicker(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Send Product</h3>
              <button className="modal-close" onClick={() => setShowProductPicker(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: "var(--space-md)" }}>
              <input type="text" className="form-input" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} style={{ marginBottom: "var(--space-md)" }} />
              <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {products.map((p) => (
                  <div key={p.id} onClick={() => handleSendProduct(p)} style={{
                    display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "var(--space-md)",
                    background: "var(--bg-glass)", borderRadius: 12, cursor: "pointer", border: "1px solid var(--border-subtle)",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={18} style={{ color: "var(--text-tertiary)" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{p.category} • {p.stock} in stock</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>{p.price} EGP</div>
                  </div>
                ))}
                {products.length === 0 && <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "var(--space-xl)" }}>No products found</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showOrderModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowOrderModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Create Order — {activeConv?.customer?.name}</h3>
              <button className="modal-close" onClick={() => setShowOrderModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Add products */}
              <div className="form-group">
                <label className="form-label">Add Products</label>
                <input type="text" className="form-input" placeholder="Search products to add..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                {productSearch && (
                  <div style={{ maxHeight: 150, overflowY: "auto", marginTop: 6, background: "var(--bg-glass)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                    {products.filter(p => !orderItems.find(i => i.id === p.id)).map((p) => (
                      <div key={p.id} onClick={() => { setOrderItems([...orderItems, { ...p, qty: 1 }]); setProductSearch(""); }} style={{
                        display: "flex", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", fontSize: "var(--font-size-sm)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}>
                        <span>{p.name}</span>
                        <span style={{ fontWeight: 600, color: "var(--accent-green)" }}>{p.price} EGP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order items */}
              {orderItems.length > 0 && (
                <div style={{ marginBottom: "var(--space-md)" }}>
                  <label className="form-label">Items</label>
                  {orderItems.map((item, i) => (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "8px 12px",
                      background: "var(--bg-glass)", borderRadius: 10, marginBottom: 4, border: "1px solid var(--border-subtle)",
                    }}>
                      <span style={{ flex: 1, fontSize: "var(--font-size-sm)", fontWeight: 500 }}>{item.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button type="button" onClick={() => { const items = [...orderItems]; items[i].qty = Math.max(1, items[i].qty - 1); setOrderItems(items); }}
                          style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                        <button type="button" onClick={() => { const items = [...orderItems]; items[i].qty++; setOrderItems(items); }}
                          style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Plus size={12} />
                        </button>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", minWidth: 60, textAlign: "right" }}>{item.price * item.qty} EGP</span>
                      <button type="button" onClick={() => setOrderItems(orderItems.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: 2 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ textAlign: "right", fontWeight: 800, fontSize: "var(--font-size-lg)", marginTop: "var(--space-sm)" }}>
                    Total: {orderItems.reduce((s, i) => s + i.price * i.qty, 0)} EGP
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-input" value={orderPaymentMethod} onChange={(e) => { setOrderPaymentMethod(e.target.value); if (e.target.value === "paymob") setSendPaymentLink(true); }}>
                  <option value="cod">Cash on Delivery</option>
                  <option value="paymob">💳 Paymob — Online Payment</option>
                  <option value="vodafone_cash">Vodafone Cash</option>
                  <option value="instapay">InstaPay</option>
                  <option value="fawry">Fawry</option>
                  <option value="card">Card / Online</option>
                </select>
                {/* Paymob payment link toggle */}
                {orderPaymentMethod !== "cod" && orderPaymentMethod !== "paymob" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={sendPaymentLink} onChange={(e) => setSendPaymentLink(e.target.checked)} style={{ accentColor: "var(--accent-primary)" }} />
                    Send Paymob payment link to customer
                  </label>
                )}
                {orderPaymentMethod === "paymob" && (
                  <div style={{ marginTop: 6, padding: "8px 12px", background: "rgba(108,92,231,0.1)", borderRadius: 8, border: "1px solid rgba(108,92,231,0.2)", fontSize: 11, color: "var(--accent-primary-light)" }}>
                    💳 A Paymob payment link will be sent to the customer. They can pay with card, Fawry, Vodafone Cash, or InstaPay.
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="form-group">
                <label className="form-label">Shipping Address</label>
                <textarea className="form-input form-textarea" value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} placeholder="Customer address..." rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrder} disabled={orderItems.length === 0 || orderSaving}>
                {orderSaving ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Check size={16} /> Create Order</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
