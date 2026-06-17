"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Send, Search, Bot, Phone, MoreVertical,
  FlaskConical, Package, ShoppingBag, Tag, X, Plus, Minus,
  ChevronRight, Camera, Globe, Clock, User, Mail,
  MapPin, Hash, Star, ArrowRight, Check, Loader2,
  FileText, AlertCircle, Zap, ChevronDown, MessageSquare,
  Megaphone, AlertTriangle, BellOff, Mic, MicOff, Image as ImageIcon,
  ArrowLeft, Filter, Hand, ThumbsUp, ThumbsDown, Pause, Play,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";
import { useDevice } from "@/lib/use-device";
import RecommendationsCard from "../components/RecommendationsCard";
import VoiceRecorder from "../components/VoiceRecorder";
import ImageUploader from "../components/ImageUploader";

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
  whatsapp: <MessageSquare size={14} />,
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "var(--accent-secondary)" },
  { value: "in_progress", label: "In Progress", color: "var(--accent-primary-light)" },
  { value: "needs_attention", label: "Needs Attention", color: "#e74c3c" },
  { value: "waiting_customer", label: "Waiting", color: "var(--accent-orange)" },
  { value: "closed", label: "Closed", color: "var(--text-tertiary)" },
];

export default function ConversationsPage() {
  const { isMobile } = useDevice();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

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

  // Summarize
  const [summarizing, setSummarizing] = useState(false);
  const [conversationSummary, setConversationSummary] = useState("");

  // Quick Replies
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [qrSearch, setQrSearch] = useState("");

  // Channel filter
  const [channelFilter, setChannelFilter] = useState("all");

  // Quick Broadcast
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Slash command
  const [slashResults, setSlashResults] = useState([]);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  // Image recognition
  const [imageRecognitionResults, setImageRecognitionResults] = useState({});
  const [showImageUploader, setShowImageUploader] = useState(false);

  // Mobile navigation (legacy)
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // ─── New Mobile View State ───
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat' | 'profile'
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileStatusMenu, setShowMobileStatusMenu] = useState(false);
  const [showMobileQRSheet, setShowMobileQRSheet] = useState(false);

  const messagesEndRef = useRef(null);
  const simulatorEndRef = useRef(null);
  const activeConvRef = useRef(null);
  const supabase = createClient();

  // Keep ref in sync with state so callbacks always see the latest value
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  // ─── Fetch Quick Replies ───
  const fetchQuickReplies = useCallback(async () => {
    try {
      const res = await fetch("/api/quick-replies");
      const data = await res.json();
      if (data.success) {
        setQuickReplies(data.quickReplies || []);
      }
    } catch (err) {
      console.error("Failed to fetch quick replies:", err);
    }
  }, []);

  useEffect(() => { fetchQuickReplies(); }, [fetchQuickReplies]);

  // ─── Fetch conversations ───
  const fetchConversations = useCallback(async () => {
    // Fetch account plan for data retention
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: acct } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
      if (acct?.plan) setAccountPlan(acct.plan);

      // Use explicit account_id filter for reliability (don't rely solely on RLS)
      const { data } = await supabase
        .from("conversations")
        .select("*, customer:customers(id, name, phone, channel, platform, platform_id, tags, total_orders, total_spent, profile_pic_url, is_returning)")
        .eq("account_id", user.id)
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
        // Use ref instead of stale closure value
        if (!activeConvRef.current && convsWithLastMsg.length > 0) {
          setActiveConv(convsWithLastMsg[0]);
        }
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

  // ─── Auto-refresh conversation list every 15 seconds ───
  useEffect(() => {
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // ─── Real-time: New message in active conversation ───
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
        setMessages((prev) => {
          // Avoid duplicates (real-time + fetchMessages race)
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        // Refresh conversation list to update last message preview
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv, fetchConversations]);

  // ─── Real-time: New conversation created (incoming message from new user) ───
  useEffect(() => {
    let channel;
    let userId = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      channel = supabase
        .channel("conversations:global")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `account_id=eq.${userId}`,
        }, () => {
          fetchConversations();
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `account_id=eq.${userId}`,
        }, () => {
          fetchConversations();
        })
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  // ─── Send message ───
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!newMsg.trim() || !activeConv || sending) return;
    setSending(true);
    setSendError("");

    try {
      if (activeConv.channel === "whatsapp" || activeConv.channel === "instagram" || activeConv.channel === "facebook") {
        // Send via the API route — it handles channel delivery AND DB save
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
          console.error("Failed to send message:", data.error);
          setSendError(data.error || "Failed to send message");
          setSending(false);
          return;
        }
      } else {
        // For other channels (or no channel), just save locally
        await supabase.from("messages").insert({
          conversation_id: activeConv.id,
          account_id: activeConv.account_id,
          direction: "outgoing",
          content: newMsg.trim(),
          type: "text",
          is_ai: false,
        });
      }

      // Only update conversation locally for non-API paths (API route already does it)
      if (activeConv.channel !== "whatsapp" && activeConv.channel !== "instagram" && activeConv.channel !== "facebook") {
        await supabase.from("conversations")
          .update({ last_message_at: new Date().toISOString(), status: "waiting_customer" })
          .eq("id", activeConv.id);
      }

      setNewMsg("");
      await fetchMessages();
      await fetchConversations();
    } catch (err) {
      console.error("Send error:", err);
      setSendError("Network error — please try again");
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

  // ─── Summarize conversation ───
  const handleSummarize = async () => {
    if (!activeConv || summarizing) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: activeConv.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConversationSummary(data.summary);
      } else {
        console.error("Summarize failed:", data.error);
      }
    } catch (err) {
      console.error("Summarize error:", err);
    }
    setSummarizing(false);
  };

  // ─── H2: Pause AI / Take Over toggle ───
  const [aiPausedForConv, setAiPausedForConv] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);

  useEffect(() => {
    if (activeConv) {
      setAiPausedForConv(!!activeConv.ai_paused);
    }
  }, [activeConv?.id]);

  const handleToggleAi = async () => {
    if (!activeConv || togglingAi) return;
    setTogglingAi(true);
    try {
      const action = aiPausedForConv ? "resume_ai" : "take_over";
      const res = await fetch(`/api/conversations/${activeConv.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setAiPausedForConv(!aiPausedForConv);
      }
    } catch (e) {
      console.error("Toggle AI failed:", e);
    } finally {
      setTogglingAi(false);
    }
  };

  // ─── H3: AI feedback (thumbs up/down) ───
  const handleAiFeedback = async (messageId, rating) => {
    try {
      await fetch(`/api/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch (e) { /* ignore */ }
  };

  // ─── Send product card into chat ───
  const handleSendProduct = async (product) => {
    if (!activeConv) return;
    const content = `📦 ${product.name}\n💰 ${product.price} EGP\n${product.description || ""}`;

    try {
      // Send via Meta API for Facebook/Instagram channels, or WhatsApp API
      if (activeConv.channel === "instagram" || activeConv.channel === "facebook" || activeConv.channel === "whatsapp") {
        const res = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConv.id,
            content,
            type: activeConv.channel === "whatsapp" ? "text" : "product_card",
            ...(activeConv.channel !== "whatsapp" && {
              product: {
                name: product.name,
                price: product.price,
                currency: "EGP",
                description: product.description || "",
                image_urls: product.image_urls || [],
                id: product.id,
              },
            }),
            ...(activeConv.channel === "whatsapp" && { channel: "whatsapp" }),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error(`Failed to send product card to ${activeConv.channel}:`, data.error);
          // Fallback: save locally even if delivery fails
          await supabase.from("messages").insert({
            conversation_id: activeConv.id,
            account_id: activeConv.account_id,
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
          account_id: activeConv.account_id,
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
        account_id: activeConv.account_id,
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

      // Send confirmation via Meta API for Facebook/Instagram channels or WhatsApp
      try {
        if (activeConv.channel === "instagram" || activeConv.channel === "facebook" || activeConv.channel === "whatsapp") {
          const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: activeConv.id,
              content: confirmationContent,
              type: "text",
              ...(activeConv.channel === "whatsapp" && { channel: "whatsapp" }),
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            console.error(`Failed to send order confirmation to ${activeConv.channel}:`, data.error);
            // Fallback: save locally
            await supabase.from("messages").insert({
              conversation_id: activeConv.id,
              account_id: activeConv.account_id,
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
            account_id: activeConv.account_id,
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
          account_id: activeConv.account_id,
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

  // ─── Handle image message from ImageUploader ───
  const handleSendImageMessage = useCallback(async (aiResponse, analysis, products) => {
    if (!activeConv) return;

    // Save the AI response about the image as a message
    const content = aiResponse || `I see the image you sent. ${analysis || "Let me analyze it and get back to you."}`;

    try {
      await supabase.from("messages").insert({
        conversation_id: activeConv.id,
        account_id: activeConv.account_id,
        direction: "outgoing",
        content,
        type: "text",
        is_ai: true,
      });

      await supabase.from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConv.id);

      fetchMessages();
      fetchConversations();
    } catch (err) {
      console.error("Send image message error:", err);
    }
  }, [activeConv, supabase, fetchMessages, fetchConversations]);

  // ─── Auto-run recognition on incoming image messages ───
  const handleAutoRecognize = useCallback(async (messageId, imageUrl) => {
    if (imageRecognitionResults[messageId]) return; // Already processed

    try {
      const res = await fetch("/api/messages/recognize-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, conversation_id: activeConv?.id }),
      });

      const data = await res.json();
      if (data.success) {
        setImageRecognitionResults((prev) => ({
          ...prev,
          [messageId]: {
            analysis: data.analysis,
            products: data.products || [],
            ai_response: data.ai_response,
          },
        }));
      }
    } catch (err) {
      console.error("Auto-recognize error:", err);
    }
  }, [activeConv, imageRecognitionResults]);

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

  // ─── Group quick replies by category ───
  const quickRepliesByCategory = (() => {
    const filtered = quickReplies.filter((qr) => {
      if (!qrSearch) return true;
      const s = qrSearch.toLowerCase();
      return (
        qr.title?.toLowerCase().includes(s) ||
        qr.content?.toLowerCase().includes(s) ||
        qr.category?.toLowerCase().includes(s)
      );
    });
    const grouped = {};
    for (const qr of filtered) {
      const cat = qr.category || "General";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(qr);
    }
    return grouped;
  })();

  // ─── Filter conversations ───
  const filteredConvs = conversations.filter((c) => {
    if (search && !c.customer?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    return true;
  });

  const statusColor = STATUS_OPTIONS.find((s) => s.value === activeConv?.status)?.color || "var(--text-tertiary)";

  // ─── Shared: Render a single message ───
  const renderMessage = (msg) => (
    <div
      key={msg.id}
      className={`chat-msg ${msg.direction === "incoming" ? "incoming" : msg.is_ai ? "ai-reply" : "outgoing"}`}
    >
      {msg.is_ai && <span className="ai-label"><Bot size={10} /> AI Auto-Reply</span>}
      {msg.sentiment && (msg.sentiment === "negative" || msg.sentiment === "urgent") && msg.direction === "incoming" && (
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 8, marginBottom: 4, display: "inline-block",
          background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)",
        }}>
          🔴 {msg.sentiment}
        </span>
      )}
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
      ) : msg.type === "image" && msg.media_url ? (
        <div className="msg-bubble" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: "var(--space-md)", maxWidth: 280 }}>
          <div className="chat-image-thumbnail" onClick={() => {
            if (!imageRecognitionResults[msg.id]) {
              handleAutoRecognize(msg.id, msg.media_url);
            }
          }}>
            <img src={msg.media_url} alt="Customer sent image" className="chat-image-thumb" />
            {!imageRecognitionResults[msg.id] && (
              <div className="chat-image-recognize-hint">
                <Camera size={12} /> Click to find matching products
              </div>
            )}
          </div>
          {msg.content && <div style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-line" }}>{msg.content}</div>}
          {imageRecognitionResults[msg.id] && (
            <div className="chat-image-recognition-results">
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-secondary)", textTransform: "uppercase", marginBottom: 4 }}>
                🔍 Product Matches
              </div>
              {(imageRecognitionResults[msg.id].products || []).slice(0, 3).map((product) => (
                <div key={product.id} className="chat-recognition-product" onClick={() => handleSendProduct(product)}>
                  <Package size={11} style={{ color: "var(--accent-primary-light)", flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{product.price} EGP • {product.confidence}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>{msg.content}</>
      )}
      <span className="msg-time">{formatTime(msg.created_at)}</span>
      {msg.is_ai && msg.direction === "outgoing" && (
        <div className="ai-feedback" style={{ display: "flex", gap: 4, marginTop: 4, opacity: 0.6 }}>
          <button
            onClick={() => handleAiFeedback(msg.id, "up")}
            title="Good reply"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => handleAiFeedback(msg.id, "down")}
            title="Bad reply"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════
  //  MOBILE RENDERING
  // ═══════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ height: "calc(100vh - 56px)", overflow: "hidden", position: "relative" }}>

        {/* ═══ MOBILE VIEW: Conversation List ═══ */}
        {mobileView === "list" && (
          <div className="mobile-conv-list">
            {/* Header */}
            <div className="mobile-conv-list-header">
              <h2>Chats</h2>
              <div className="mobile-conv-list-actions">
                <button onClick={() => setShowMobileSearch(!showMobileSearch)} title="Search">
                  <Search size={20} />
                </button>
                <button onClick={() => setShowMobileFilters(!showMobileFilters)} title="Filters">
                  <Filter size={20} />
                </button>
              </div>
            </div>

            {/* Expandable search bar */}
            {showMobileSearch && (
              <div className="mobile-search-bar">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Horizontally scrollable filter chips */}
            <div className="mobile-filter-chips">
              {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((s) => (
                <button
                  key={s.value}
                  className={`mobile-filter-chip ${statusFilter === s.value ? "active" : ""}`}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.value !== "all" && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  )}
                  {s.label}
                </button>
              ))}
              <div className="mobile-filter-chip-divider" />
              {[
                { value: "all", label: "All" },
                { value: "instagram", label: "📷 IG" },
                { value: "facebook", label: "🌐 FB" },
                { value: "whatsapp", label: "📱 WA" },
              ].map((ch) => (
                <button
                  key={ch.value}
                  className={`mobile-filter-chip ${channelFilter === ch.value ? "channel-active" : ""}`}
                  onClick={() => setChannelFilter(ch.value)}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Conversation items */}
            <div className="mobile-conv-items">
              {loading ? (
                <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
                  <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: "var(--font-size-sm)" }}>Loading...</div>
                </div>
              ) : filteredConvs.length === 0 ? (
                <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                  No conversations found
                </div>
              ) : filteredConvs.map((conv) => (
                <div
                  key={conv.id}
                  className="mobile-conv-item"
                  onClick={() => {
                    setActiveConv(conv);
                    setSimulatorMode(false);
                    setMobileView("chat");
                    setConversationSummary("");
                  }}
                >
                  {/* Avatar */}
                  <div className="mobile-conv-avatar" style={{ background: conv.customer?.profile_pic_url ? "transparent" : "var(--accent-gradient)" }}>
                    {conv.customer?.profile_pic_url ? (
                      <img src={conv.customer.profile_pic_url} alt="" />
                    ) : (
                      conv.customer?.name?.split(" ").map(n => n[0]).join("") || "?"
                    )}
                    <span className="mobile-conv-avatar-badge">
                      {CHANNEL_ICON[conv.channel] || CHANNEL_ICON.instagram}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="mobile-conv-content">
                    <div className="mobile-conv-top">
                      <span className="mobile-conv-name">
                        {conv.customer?.name || "Unknown"}
                        {conv.customer?.is_returning && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(88,101,242,0.15)", color: "var(--accent-primary-light)" }}>↩</span>}
                      </span>
                      <span className={`mobile-conv-time ${conv.unread_count > 0 ? "unread" : ""}`}>
                        {formatRelative(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="mobile-conv-preview">
                      {conv.lastMessage?.is_ai && <Bot size={11} style={{ color: "var(--accent-secondary)", flexShrink: 0 }} />}
                      {conv.lastMessage?.intent && conv.lastMessage.intent !== "general" && (
                        <span className="mobile-conv-intent" style={{ background: INTENT_CONFIG[conv.lastMessage.intent]?.color + "22", color: INTENT_CONFIG[conv.lastMessage.intent]?.color }}>
                          {INTENT_CONFIG[conv.lastMessage.intent]?.label}
                        </span>
                      )}
                      <span className="mobile-conv-preview-text">
                        {conv.lastMessage?.content?.slice(0, 50) || "No messages yet"}
                      </span>
                    </div>
                  </div>

                  {/* Unread badge */}
                  {conv.unread_count > 0 && (
                    <span className="mobile-conv-unread">{conv.unread_count}</span>
                  )}
                </div>
              ))}
            </div>

            {/* FAB */}
            <button className="mobile-fab" onClick={() => setShowBroadcastModal(true)} title="Quick Broadcast">
              <Megaphone size={22} />
            </button>
          </div>
        )}

        {/* ═══ MOBILE VIEW: Chat ═══ */}
        {mobileView === "chat" && activeConv && (
          <div className="mobile-chat-view">
            {/* Chat Header */}
            <div className="mobile-chat-header" style={{ position: "relative" }}>
              <button className="mobile-chat-header-back" onClick={() => setMobileView("list")}>
                <ArrowLeft size={22} />
              </button>

              <div className="mobile-chat-header-info" onClick={() => setMobileView("profile")}>
                <div className="mobile-chat-header-avatar" style={{ background: activeConv.customer?.profile_pic_url ? "transparent" : "var(--accent-gradient)" }}>
                  {activeConv.customer?.profile_pic_url ? (
                    <img src={activeConv.customer.profile_pic_url} alt="" />
                  ) : (
                    activeConv.customer?.name?.split(" ").map(n => n[0]).join("")
                  )}
                </div>
                <div className="mobile-chat-header-text">
                  <div className="mobile-chat-header-name">{activeConv.customer?.name}</div>
                  <div className="mobile-chat-header-channel">
                    {CHANNEL_ICON[activeConv.channel]}
                    {activeConv.channel === "instagram" ? "Instagram" : activeConv.channel === "facebook" ? "Facebook" : "WhatsApp"}
                  </div>
                </div>
              </div>

              <div className="mobile-chat-header-actions">
                {/* Negative sentiment indicator */}
                {(activeConv.tags || []).some(t => t.startsWith("sentiment:negative") || t.startsWith("sentiment:urgent")) && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                    background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)",
                  }}>
                    🔴
                  </span>
                )}
                {/* AI Escalation indicator */}
                {(activeConv.tags || []).some(t => t.startsWith("escalated:")) && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                    background: "rgba(231, 76, 60, 0.15)", color: "#e74c3c",
                  }}>
                    🤖
                  </span>
                )}
                {/* AI status badge — compact, fits the 38px action slot */}
                <button
                  onClick={handleToggleAi}
                  disabled={togglingAi}
                  title={aiPausedForConv ? "Resume AI auto-replies" : "Pause AI — take over"}
                  className="mobile-ai-toggle"
                  style={{
                    background: aiPausedForConv
                      ? "rgba(59,165,92,0.18)"
                      : "rgba(248,165,50,0.18)",
                    color: aiPausedForConv ? "var(--accent-green)" : "var(--accent-orange)",
                    border: `1px solid ${aiPausedForConv ? "rgba(59,165,92,0.4)" : "rgba(248,165,50,0.4)"}`,
                    opacity: togglingAi ? 0.5 : 1,
                  }}
                >
                  {togglingAi ? (
                    <Loader2 size={16} className="spin" />
                  ) : aiPausedForConv ? (
                    <Play size={16} />
                  ) : (
                    <Pause size={16} />
                  )}
                </button>
                <button onClick={handleSummarize} disabled={summarizing} title="Summarize">
                  {summarizing ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}
                </button>
                <button onClick={() => setShowMobileStatusMenu(!showMobileStatusMenu)} title="Status">
                  <MoreVertical size={18} />
                </button>
              </div>

              {/* Status dropdown menu */}
              {showMobileStatusMenu && (
                <div className="mobile-status-menu">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      className="mobile-status-option"
                      onClick={() => { updateConvStatus(s.value); setShowMobileStatusMenu(false); }}
                      style={{ background: activeConv.status === s.value ? "rgba(108,92,231,0.08)" : "none" }}
                    >
                      <span className="mobile-status-dot" style={{ background: s.color }} />
                      {s.label}
                      {activeConv.status === s.value && <Check size={14} style={{ marginLeft: "auto", color: "var(--accent-primary)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="mobile-chat-messages">
              {/* AI Summary banner */}
              {conversationSummary && (
                <div className="mobile-summary-banner">
                  <FileText size={14} style={{ color: "var(--accent-primary-light)", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--accent-primary-light)", fontSize: 10, marginBottom: 2, textTransform: "uppercase" }}>AI Summary</div>
                    {conversationSummary}
                  </div>
                  <button onClick={() => setConversationSummary("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, marginLeft: "auto", flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions row */}
            <div className="mobile-quick-actions">
              <button className="mobile-quick-action-btn" onClick={() => setShowProductPicker(true)}>
                <Package size={13} /> Product
              </button>
              <button className="mobile-quick-action-btn" onClick={() => { setShowOrderModal(true); setOrderItems([]); }}>
                <ShoppingBag size={13} /> Order
              </button>
              <button className={`mobile-quick-action-btn ${showMobileQRSheet ? "active" : ""}`} onClick={() => setShowMobileQRSheet(!showMobileQRSheet)}>
                <Zap size={13} /> Quick Reply
              </button>
              <button className="mobile-quick-action-btn" onClick={() => updateConvStatus("closed")} style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>
                Close
              </button>
            </div>

            {/* Input area */}
            {sendError && (
              <div style={{ padding: "6px 12px", background: "rgba(231,76,60,0.1)", color: "#e74c3c", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>⚠ {sendError}</span>
                <button type="button" onClick={() => setSendError("")} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
              </div>
            )}
            <form className="mobile-chat-input-area" onSubmit={handleSend}>
              <div className="mobile-chat-input-wrapper">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMsg}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewMsg(val);
                    if (val.startsWith("/")) {
                      const query = val.slice(1).toLowerCase();
                      const matches = quickReplies.filter(qr =>
                        qr.shortcut?.toLowerCase().startsWith(query) ||
                        qr.title?.toLowerCase().includes(query) ||
                        qr.content?.toLowerCase().includes(query)
                      ).slice(0, 6);
                      setSlashResults(matches);
                      setShowSlashMenu(matches.length > 0);
                      setSlashActiveIndex(0);
                    } else {
                      setShowSlashMenu(false);
                      setSlashResults([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (showSlashMenu && slashResults.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashActiveIndex(prev => Math.min(prev + 1, slashResults.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashActiveIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                        if (slashResults[slashActiveIndex]) {
                          e.preventDefault();
                          const qr = slashResults[slashActiveIndex];
                          const personalized = (qr.content || "")
                            .replace(/\{name\}/g, activeConv?.customer?.name || "Customer")
                            .replace(/\{business_name\}/g, "our store");
                          setNewMsg(personalized);
                          setShowSlashMenu(false);
                          setSlashResults([]);
                        }
                      } else if (e.key === "Escape") {
                        setShowSlashMenu(false);
                        setSlashResults([]);
                      }
                    }
                  }}
                />
                <VoiceRecorder
                  compact
                  onTranscribe={(text) => { setNewMsg(text); }}
                  disabled={sending}
                />
                <ImageUploader
                  compact
                  onProductSelect={(product) => handleSendProduct(product)}
                  onSendImageMessage={handleSendImageMessage}
                  disabled={sending}
                />
              </div>
              <button type="submit" className="mobile-chat-send-btn" disabled={!newMsg.trim() || sending}>
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {/* ═══ MOBILE VIEW: Simulator (full screen) ═══ */}
        {mobileView === "chat" && simulatorMode && (
          <div className="mobile-chat-view">
            <div className="mobile-chat-header" style={{ background: "rgba(88, 101, 242, 0.05)" }}>
              <button className="mobile-chat-header-back" onClick={() => { setSimulatorMode(false); setMobileView("list"); }}>
                <ArrowLeft size={22} />
              </button>
              <div className="mobile-chat-header-info">
                <div className="mobile-chat-header-avatar" style={{ background: "var(--accent-gradient)", color: "white" }}>
                  <Bot size={18} />
                </div>
                <div className="mobile-chat-header-text">
                  <div className="mobile-chat-header-name">AI Simulator</div>
                  <div className="mobile-chat-header-channel" style={{ color: "var(--accent-primary-light)" }}>Testing your catalog</div>
                </div>
              </div>
            </div>
            <div className="mobile-chat-messages">
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
            <div className="mobile-chat-input-area">
              <div className="mobile-chat-input-wrapper">
                <input
                  type="text"
                  placeholder="Test a customer message..."
                  value={simInput || ""}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSimSubmit())}
                  disabled={simLoading}
                />
              </div>
              <button type="button" className="mobile-chat-send-btn" onClick={handleSimSubmit} disabled={!(simInput || "").trim() || simLoading}>
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ MOBILE VIEW: Profile Sheet ═══ */}
        {mobileView === "profile" && activeConv && (
          <>
            <div className="mobile-profile-overlay" onClick={() => setMobileView("chat")} />
            <div className="mobile-profile-sheet">
              {/* Handle */}
              <div className="mobile-profile-handle" />

              {/* Header with close */}
              <div className="mobile-profile-header">
                <button onClick={() => setMobileView("chat")}>
                  <ArrowLeft size={18} />
                </button>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Customer Info</span>
                <button onClick={() => setMobileView("chat")}>
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="mobile-profile-body">
                {/* Avatar */}
                <div className="mobile-profile-avatar" style={{ background: customerInfo?.profile_pic_url ? "transparent" : "var(--accent-gradient)" }}>
                  {customerInfo?.profile_pic_url ? (
                    <img src={customerInfo.profile_pic_url} alt="" />
                  ) : (
                    customerInfo?.name?.split(" ").map(n => n[0]).join("") || "?"
                  )}
                </div>
                <div className="mobile-profile-name">{customerInfo?.name || "Unknown"}</div>
                <div className="mobile-profile-channel">
                  {CHANNEL_ICON[customerInfo?.platform || customerInfo?.channel]}
                  {customerInfo?.platform || customerInfo?.channel}
                  {customerInfo?.is_returning && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "rgba(59,165,92,0.15)", color: "var(--accent-green)" }}>Returning</span>}
                </div>

                {/* Stats */}
                <div className="mobile-profile-stats">
                  <div className="mobile-profile-stat">
                    <div className="mobile-profile-stat-value" style={{ color: "var(--accent-primary-light)" }}>{customerInfo?.total_orders || 0}</div>
                    <div className="mobile-profile-stat-label">Orders</div>
                  </div>
                  <div className="mobile-profile-stat">
                    <div className="mobile-profile-stat-value" style={{ color: "var(--accent-green)" }}>{customerInfo?.total_spent?.toLocaleString() || 0}</div>
                    <div className="mobile-profile-stat-label">EGP Spent</div>
                  </div>
                </div>

                {/* Details */}
                <div className="mobile-profile-section-title">Details</div>
                {customerInfo?.phone && (
                  <div className="mobile-profile-detail">
                    <Phone size={14} className="mobile-profile-detail-icon" /> {customerInfo.phone}
                  </div>
                )}
                {customerInfo?.email && (
                  <div className="mobile-profile-detail">
                    <Mail size={14} className="mobile-profile-detail-icon" /> {customerInfo.email}
                  </div>
                )}
                {customerInfo?.address && (
                  <div className="mobile-profile-detail">
                    <MapPin size={14} className="mobile-profile-detail-icon" /> {customerInfo.address}
                  </div>
                )}
                <div className="mobile-profile-detail">
                  <Hash size={14} className="mobile-profile-detail-icon" /> {customerInfo?.platform_id?.slice(0, 16) || "N/A"}
                </div>
                <div className="mobile-profile-detail" style={{ marginBottom: 16 }}>
                  <Clock size={14} className="mobile-profile-detail-icon" /> Joined {customerInfo?.first_seen_at ? formatDate(customerInfo.first_seen_at) : formatDate(customerInfo?.created_at)}
                </div>

                {/* Tags */}
                <div className="mobile-profile-section-title">Tags</div>
                <div className="mobile-profile-tags">
                  {(customerInfo?.tags || []).map((tag, i) => (
                    <span key={i} className="mobile-profile-tag" style={tag === "VIP" ? { background: "rgba(88,101,242,0.15)", color: "var(--accent-primary-light)", borderColor: "rgba(88,101,242,0.3)" } : {}}>
                      {tag}
                    </span>
                  ))}
                  {(!customerInfo?.tags || customerInfo.tags.length === 0) && (
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No tags</span>
                  )}
                </div>

                {/* Recent orders */}
                <div className="mobile-profile-section-title">Recent Orders</div>
                {customerOrders.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>No orders yet</p>
                ) : customerOrders.map((order) => (
                  <div key={order.id} className="mobile-profile-order">
                    <div className="mobile-profile-order-top">
                      <span style={{ fontWeight: 600, color: "var(--accent-primary-light)" }}>{order.order_number}</span>
                      <span style={{ fontWeight: 700 }}>{order.total} EGP</span>
                    </div>
                    <div className="mobile-profile-order-bottom">
                      {order.status} • {formatDate(order.created_at)}
                    </div>
                  </div>
                ))}

                {/* Recommendations */}
                <RecommendationsCard
                  customerId={activeConv?.customer?.id}
                  onSendProduct={handleSendProduct}
                />
              </div>
            </div>
          </>
        )}

        {/* ═══ Mobile Quick Reply Bottom Sheet ═══ */}
        {showMobileQRSheet && (
          <>
            <div className="mobile-profile-overlay" onClick={() => { setShowMobileQRSheet(false); setQrSearch(""); }} />
            <div className="mobile-qr-sheet">
              <div className="mobile-profile-handle" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px 12px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Quick Replies</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Tap to fill</span>
              </div>
              <div style={{ padding: "0 16px 8px" }}>
                <input
                  className="mobile-qr-search"
                  type="text"
                  placeholder="Search templates..."
                  value={qrSearch}
                  onChange={(e) => setQrSearch(e.target.value)}
                />
              </div>
              <div className="mobile-qr-items">
                {quickReplies.length === 0 ? (
                  <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                    No templates yet. Add some in Settings.
                  </div>
                ) : Object.keys(quickRepliesByCategory).length === 0 ? (
                  <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                    No matches found.
                  </div>
                ) : Object.entries(quickRepliesByCategory).map(([category, qrs]) => (
                  <div key={category}>
                    <div className="mobile-qr-category">{category}</div>
                    {qrs.map((qr) => (
                      <div
                        key={qr.id}
                        className="mobile-qr-item"
                        onClick={() => {
                          const personalized = (qr.content || "")
                            .replace(/\{name\}/g, activeConv?.customer?.name || "Customer")
                            .replace(/\{business_name\}/g, "our store");
                          setNewMsg(personalized);
                          setShowMobileQRSheet(false);
                          setQrSearch("");
                        }}
                      >
                        <div className="mobile-qr-item-title">{qr.title}</div>
                        <div className="mobile-qr-item-preview">{qr.content}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ Shared Modals (used by both mobile and desktop) ═══ */}

        {/* Product Picker Modal */}
        {showProductPicker && createPortal(
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
        , document.body)}

        {/* Create Order Modal */}
        {showOrderModal && createPortal(
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
        , document.body)}

        {/* Quick Broadcast Modal */}
        {showBroadcastModal && createPortal(
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBroadcastModal(false)}>
            <div className="modal" style={{ maxWidth: 560 }}>
              <div className="modal-header">
                <h3><Megaphone size={18} style={{ display: "inline", verticalAlign: -3, marginRight: 8 }} />Quick Broadcast</h3>
                <button className="modal-close" onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); }}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-lg)" }}>
                  Send a message to all open conversations at once. Each message is personalized with the customer&apos;s name.
                </p>

                {broadcastResult && (
                  <div style={{
                    padding: "var(--space-md)", marginBottom: "var(--space-md)", borderRadius: "var(--radius-md)",
                    background: broadcastResult.type === "success" ? "rgba(0,200,83,0.1)" : "rgba(255,82,82,0.1)",
                    border: `1px solid ${broadcastResult.type === "success" ? "rgba(0,200,83,0.3)" : "rgba(255,82,82,0.3)"}`,
                    color: broadcastResult.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
                    fontSize: "var(--font-size-sm)", fontWeight: 500,
                  }}>
                    {broadcastResult.message}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Broadcast Message</label>
                  <textarea
                    className="form-input form-textarea"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    rows={4}
                    placeholder="Hi {name}! We have an exciting new offer at {business_name}..."
                  />
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                    Use {"{name}"} for customer name, {"{business_name}"} for your store name
                  </p>
                </div>

                <div style={{
                  padding: "var(--space-sm) var(--space-md)",
                  background: "rgba(108,92,231,0.08)", borderRadius: "var(--radius-sm)",
                  fontSize: "var(--font-size-sm)", color: "var(--accent-primary-light)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <MessageCircle size={14} />
                  {conversations.filter(c => c.status !== "closed").length} open conversations will receive this message
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); }}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!broadcastMessage.trim() || broadcastSending}
                  onClick={async () => {
                    setBroadcastSending(true);
                    setBroadcastResult(null);
                    try {
                      const openConvIds = conversations
                        .filter(c => c.status !== "closed")
                        .map(c => c.id);

                      if (openConvIds.length === 0) {
                        setBroadcastResult({ type: "error", message: "No open conversations to broadcast to." });
                        setBroadcastSending(false);
                        return;
                      }

                      const res = await fetch("/api/broadcasts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          conversationIds: openConvIds,
                          message: broadcastMessage.trim(),
                        }),
                      });
                      const data = await res.json();

                      if (res.ok) {
                        setBroadcastResult({
                          type: "success",
                          message: `Broadcast sent! ${data.sent} delivered, ${data.failed} failed out of ${data.total} conversations.`,
                        });
                        setBroadcastMessage("");
                        fetchConversations();
                      } else {
                        setBroadcastResult({ type: "error", message: data.error || "Failed to send broadcast" });
                      }
                    } catch (err) {
                      setBroadcastResult({ type: "error", message: "Broadcast failed: " + err.message });
                    }
                    setBroadcastSending(false);
                  }}
                >
                  {broadcastSending ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Megaphone size={16} /> Send Broadcast</>}
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  DESKTOP RENDERING (UNCHANGED)
  // ═══════════════════════════════════════════════════════
  return (
    <div className="conversations-layout" style={{ gridTemplateColumns: showInfoPanel && activeConv && !simulatorMode ? "300px 1fr 320px" : "300px 1fr" }}>

      {/* ═══════ LEFT PANEL: Conversation List ═══════ */}
      <div className={`conv-list${mobileChatOpen ? " mobile-hidden" : ""}`}>
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

          {/* Channel filter tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {[
              { value: "all", label: "All Channels" },
              { value: "instagram", label: "📷 IG" },
              { value: "facebook", label: "🌐 FB" },
              { value: "whatsapp", label: "📱 WA" },
            ].map((ch) => (
              <button
                key={ch.value}
                onClick={() => setChannelFilter(ch.value)}
                style={{
                  padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, border: "1px solid var(--border-subtle)", cursor: "pointer",
                  background: channelFilter === ch.value ? "var(--accent-secondary)" : "transparent",
                  color: channelFilter === ch.value ? "white" : "var(--text-tertiary)",
                  transition: "all 0.15s",
                }}
              >
                {ch.label}
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

          {/* Quick Broadcast button */}
          <button
            className="btn btn-secondary"
            onClick={() => setShowBroadcastModal(true)}
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
          >
            <Megaphone size={16} /> Quick Broadcast
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
              onClick={() => { setActiveConv(conv); setSimulatorMode(false); setMobileChatOpen(true); }}
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
                  {(conv.tags || []).some(t => t.startsWith("sentiment:negative") || t.startsWith("sentiment:urgent")) && (
                    <span style={{
                      fontSize: 9, padding: "1px 5px", borderRadius: 6,
                      background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)",
                    }}>🔴</span>
                  )}
                  {(conv.tags || []).some(t => t.startsWith("escalated:")) && (
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 6, fontWeight: 600,
                      background: "rgba(231, 76, 60, 0.15)", color: "#e74c3c", display: "inline-flex", alignItems: "center", gap: 2,
                    }}>🤖<AlertTriangle size={9} /> Escalated</span>
                  )}
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
      <div className={`chat-area${mobileChatOpen ? " mobile-visible" : ""}`}>
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
              <button className="chat-back-btn" onClick={() => setMobileChatOpen(false)} title="Back to conversations">
                <ArrowLeft size={20} />
              </button>
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
                {/* Negative sentiment indicator */}
                {(activeConv.tags || []).some(t => t.startsWith("sentiment:negative") || t.startsWith("sentiment:urgent")) && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                    background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)",
                    border: "1px solid rgba(255, 82, 82, 0.3)",
                  }}>
                    🔴 {(activeConv.tags || []).find(t => t.startsWith("sentiment:"))?.replace("sentiment:", "") || "Negative"}
                  </span>
                )}
                {/* AI Escalation indicator */}
                {(activeConv.tags || []).some(t => t.startsWith("escalated:")) && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    background: "linear-gradient(135deg, rgba(231, 76, 60, 0.15), rgba(192, 57, 43, 0.15))",
                    color: "#e74c3c",
                    border: "1px solid rgba(231, 76, 60, 0.4)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}>
                    <AlertTriangle size={12} /> AI Escalated — Needs Human
                  </span>
                )}
                {/* Summarize button */}
                <button
                  className="topbar-btn"
                  title="Summarize conversation"
                  onClick={handleSummarize}
                  disabled={summarizing}
                  style={{ position: "relative" }}
                >
                  {summarizing ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                </button>
                {/* Pause AI / Resume AI button */}
                <button
                  onClick={handleToggleAi}
                  disabled={togglingAi}
                  title={aiPausedForConv ? "Resume AI auto-replies" : "Pause AI — take over this conversation"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    background: aiPausedForConv
                      ? "rgba(59,165,92,0.15)"
                      : "rgba(248,165,50,0.15)",
                    color: aiPausedForConv ? "var(--accent-green)" : "var(--accent-orange)",
                    border: `1px solid ${aiPausedForConv ? "rgba(59,165,92,0.3)" : "rgba(248,165,50,0.3)"}`,
                    opacity: togglingAi ? 0.5 : 1,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {togglingAi ? (
                    <Loader2 size={13} className="spin" />
                  ) : aiPausedForConv ? (
                    <Play size={13} />
                  ) : (
                    <Pause size={13} />
                  )}
                  <span>{aiPausedForConv ? "Resume AI" : "Pause AI"}</span>
                </button>
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
              {/* Conversation Summary Banner */}
              {conversationSummary && (
                <div style={{
                  margin: "8px 16px", padding: "10px 14px", background: "rgba(108, 92, 231, 0.08)",
                  border: "1px solid rgba(108, 92, 231, 0.2)", borderRadius: 12,
                  fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5,
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <FileText size={14} style={{ color: "var(--accent-primary-light)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--accent-primary-light)", fontSize: 10, marginBottom: 2, textTransform: "uppercase" }}>AI Summary</div>
                    {conversationSummary}
                  </div>
                  <button onClick={() => setConversationSummary("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, marginLeft: "auto", flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              {messages.map(renderMessage)}
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
              {/* Quick Reply Button */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-subtle)",
                    background: showQuickReplies ? "var(--accent-primary)" : "var(--bg-glass)",
                    color: showQuickReplies ? "white" : "var(--text-secondary)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Zap size={13} /> Quick Reply <ChevronDown size={10} />
                </button>
                {showQuickReplies && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
                    background: "var(--bg-secondary)", border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    minWidth: 320, maxHeight: 380, display: "flex", flexDirection: "column",
                    zIndex: 50,
                  }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Quick Replies</span>
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Click to fill • Shift+Click to send</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={qrSearch}
                        onChange={(e) => setQrSearch(e.target.value)}
                        style={{
                          width: "100%", padding: "5px 10px", borderRadius: 8, fontSize: 11,
                          border: "1px solid var(--border-subtle)", background: "var(--bg-glass)",
                          color: "var(--text-primary)", outline: "none",
                          fontFamily: "var(--font-family)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {quickReplies.length === 0 ? (
                        <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                          No templates yet. Add some in Settings.
                        </div>
                      ) : Object.keys(quickRepliesByCategory).length === 0 ? (
                        <div style={{ padding: "var(--space-lg)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                          No matches found.
                        </div>
                      ) : Object.entries(quickRepliesByCategory).map(([category, qrs]) => (
                        <div key={category}>
                          <div style={{
                            padding: "6px 12px", fontSize: 10, fontWeight: 700,
                            color: "var(--accent-primary-light)", textTransform: "uppercase",
                            background: "var(--bg-glass)", borderBottom: "1px solid var(--border-subtle)",
                            letterSpacing: 0.5,
                          }}>
                            {category}
                          </div>
                          {qrs.map((qr) => (
                            <div
                              key={qr.id}
                              onClick={(e) => {
                                // Apply variable substitution
                                const personalized = (qr.content || "")
                                  .replace(/\{name\}/g, activeConv?.customer?.name || "Customer")
                                  .replace(/\{business_name\}/g, "our store");
                                if (e.shiftKey) {
                                  // Shift+Click: send immediately
                                  setNewMsg(personalized);
                                  setTimeout(() => {
                                    const form = document.getElementById("chat-send-form");
                                    if (form) form.requestSubmit();
                                  }, 50);
                                } else {
                                  // Normal click: fill input
                                  setNewMsg(personalized);
                                }
                                setShowQuickReplies(false);
                                setQrSearch("");
                              }}
                              style={{
                                padding: "8px 12px", cursor: "pointer",
                                borderBottom: "1px solid var(--border-subtle)",
                                transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-glass)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{qr.title}</div>
                              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {qr.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => updateConvStatus("closed")} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid var(--border-subtle)",
                background: "var(--bg-glass)", color: "var(--text-tertiary)", cursor: "pointer", marginLeft: "auto",
              }}>
                Close
              </button>
            </div>

            {/* ── Input ── */}
            {sendError && (
              <div style={{ padding: "6px 12px", background: "rgba(231,76,60,0.1)", color: "#e74c3c", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>⚠ {sendError}</span>
                <button type="button" onClick={() => setSendError("")} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
              </div>
            )}
            <form id="chat-send-form" className="chat-input-area" onSubmit={handleSend}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, gap: 4 }}>
                {/* Slash command menu */}
                {showSlashMenu && slashResults.length > 0 && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: 0, marginBottom: 4,
                    background: "var(--bg-secondary)", border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    minWidth: 300, maxHeight: 260, overflowY: "auto", zIndex: 50,
                  }}>
                    <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Quick Replies</div>
                    {slashResults.map((qr, i) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => {
                          const personalized = (qr.content || "")
                            .replace(/\{name\}/g, activeConv?.customer?.name || "Customer")
                            .replace(/\{business_name\}/g, "our store");
                          setNewMsg(personalized);
                          setShowSlashMenu(false);
                          setSlashResults([]);
                          document.getElementById("chat-message-input")?.focus();
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                          background: i === slashActiveIndex ? "rgba(108,92,231,0.08)" : "none",
                          border: "none", borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer", color: "var(--text-primary)", textAlign: "left",
                        }}
                      >
                        <Zap size={12} style={{ color: "var(--accent-primary-light)", flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{qr.title} {qr.shortcut && <code style={{ fontSize: 10, color: "var(--accent-primary-light)" }}>/{qr.shortcut}</code>}</div>
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{qr.content}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type a message... (type / for quick replies)"
                  value={newMsg}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewMsg(val);
                    // Slash command detection
                    if (val.startsWith("/")) {
                      const query = val.slice(1).toLowerCase();
                      const matches = quickReplies.filter(qr =>
                        qr.shortcut?.toLowerCase().startsWith(query) ||
                        qr.title?.toLowerCase().includes(query) ||
                        qr.content?.toLowerCase().includes(query)
                      ).slice(0, 6);
                      setSlashResults(matches);
                      setShowSlashMenu(matches.length > 0);
                      setSlashActiveIndex(0);
                    } else {
                      setShowSlashMenu(false);
                      setSlashResults([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (showSlashMenu && slashResults.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashActiveIndex(prev => Math.min(prev + 1, slashResults.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashActiveIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                        if (slashResults[slashActiveIndex]) {
                          e.preventDefault();
                          const qr = slashResults[slashActiveIndex];
                          const personalized = (qr.content || "")
                            .replace(/\{name\}/g, activeConv?.customer?.name || "Customer")
                            .replace(/\{business_name\}/g, "our store");
                          setNewMsg(personalized);
                          setShowSlashMenu(false);
                          setSlashResults([]);
                        }
                      } else if (e.key === "Escape") {
                        setShowSlashMenu(false);
                        setSlashResults([]);
                      }
                    }
                  }}
                  id="chat-message-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  title="Quick Replies"
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border-subtle)",
                    background: showQuickReplies ? "var(--accent-primary)" : "var(--bg-glass)",
                    color: showQuickReplies ? "white" : "var(--text-tertiary)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.15s",
                  }}
                >
                  <Zap size={16} />
                </button>
                {/* Voice Recorder Button */}
                <VoiceRecorder
                  compact
                  onTranscribe={(text) => {
                    setNewMsg(text);
                    document.getElementById("chat-message-input")?.focus();
                  }}
                  disabled={sending}
                />
                {/* Image Upload Button */}
                <div style={{ position: "relative" }}>
                  <ImageUploader
                    compact
                    onProductSelect={(product) => handleSendProduct(product)}
                    onSendImageMessage={handleSendImageMessage}
                    disabled={sending}
                  />
                </div>
                <button type="submit" className="chat-send-btn" disabled={!newMsg.trim() || sending} id="chat-send"><Send size={18} /></button>
              </div>
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

            {/* Smart Product Recommendations */}
            <RecommendationsCard
              customerId={activeConv?.customer?.id}
              onSendProduct={handleSendProduct}
            />
          </div>
        </div>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Product Picker Modal */}
      {showProductPicker && createPortal(
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
      , document.body)}

      {/* Create Order Modal */}
      {showOrderModal && createPortal(
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
      , document.body)}

      {/* ═══════ Quick Broadcast Modal ═══════ */}
      {showBroadcastModal && createPortal(
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowBroadcastModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3><Megaphone size={18} style={{ display: "inline", verticalAlign: -3, marginRight: 8 }} />Quick Broadcast</h3>
              <button className="modal-close" onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-lg)" }}>
                Send a message to all open conversations at once. Each message is personalized with the customer&apos;s name.
              </p>

              {broadcastResult && (
                <div style={{
                  padding: "var(--space-md)", marginBottom: "var(--space-md)", borderRadius: "var(--radius-md)",
                  background: broadcastResult.type === "success" ? "rgba(0,200,83,0.1)" : "rgba(255,82,82,0.1)",
                  border: `1px solid ${broadcastResult.type === "success" ? "rgba(0,200,83,0.3)" : "rgba(255,82,82,0.3)"}`,
                  color: broadcastResult.type === "success" ? "var(--accent-green)" : "var(--accent-red)",
                  fontSize: "var(--font-size-sm)", fontWeight: 500,
                }}>
                  {broadcastResult.message}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Broadcast Message</label>
                <textarea
                  className="form-input form-textarea"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  placeholder="Hi {name}! We have an exciting new offer at {business_name}..."
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Use {"{name}"} for customer name, {"{business_name}"} for your store name
                </p>
              </div>

              <div style={{
                padding: "var(--space-sm) var(--space-md)",
                background: "rgba(108,92,231,0.08)", borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-sm)", color: "var(--accent-primary-light)",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <MessageCircle size={14} />
                {conversations.filter(c => c.status !== "closed").length} open conversations will receive this message
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowBroadcastModal(false); setBroadcastResult(null); }}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!broadcastMessage.trim() || broadcastSending}
                onClick={async () => {
                  setBroadcastSending(true);
                  setBroadcastResult(null);
                  try {
                    const openConvIds = conversations
                      .filter(c => c.status !== "closed")
                      .map(c => c.id);

                    if (openConvIds.length === 0) {
                      setBroadcastResult({ type: "error", message: "No open conversations to broadcast to." });
                      setBroadcastSending(false);
                      return;
                    }

                    const res = await fetch("/api/broadcasts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        conversationIds: openConvIds,
                        message: broadcastMessage.trim(),
                      }),
                    });
                    const data = await res.json();

                    if (res.ok) {
                      setBroadcastResult({
                        type: "success",
                        message: `Broadcast sent! ${data.sent} delivered, ${data.failed} failed out of ${data.total} conversations.`,
                      });
                      setBroadcastMessage("");
                      fetchConversations();
                    } else {
                      setBroadcastResult({ type: "error", message: data.error || "Failed to send broadcast" });
                    }
                  } catch (err) {
                    setBroadcastResult({ type: "error", message: "Broadcast failed: " + err.message });
                  }
                  setBroadcastSending(false);
                }}
              >
                {broadcastSending ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Megaphone size={16} /> Send Broadcast</>}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
