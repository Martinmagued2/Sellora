"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageCircle, Clock, ToggleLeft, ToggleRight, AlertCircle,
  HelpCircle, Zap, Send, Plus, Edit, Trash2, Loader2, Megaphone,
  Globe, Smartphone, Save, Check, ShoppingCart, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SAFE_ACCOUNT_FIELDS } from "@/lib/safe-fields";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

export default function AutomationPage() {
  const toast = useToast();
  // Account / automation state
  
  const confirmAction = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [account, setAccount] = useState({});
  const [autoGreeting, setAutoGreeting] = useState(false);
  const [autoGreetingMessage, setAutoGreetingMessage] = useState("");
  const [greetingPerChannel, setGreetingPerChannel] = useState(false);
  const [instagramGreeting, setInstagramGreeting] = useState("");
  const [facebookGreeting, setFacebookGreeting] = useState("");
  const [whatsappGreeting, setWhatsappGreeting] = useState("");
  const [greetingDelaySeconds, setGreetingDelaySeconds] = useState(0);
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [sendingFollowUps, setSendingFollowUps] = useState(false);

  // Quick Replies state
  const [quickReplies, setQuickReplies] = useState([]);
  const [showAddQuickReply, setShowAddQuickReply] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState({ title: "", content: "", category: "General", shortcut: "" });
  const [quickReplySaving, setQuickReplySaving] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState(null);

  // FAQ count
  const [faqCount, setFaqCount] = useState(0);

  // Abandoned Cart Recovery state
  const [abandonedCartEnabled, setAbandonedCartEnabled] = useState(false);
  const [abandonedCartHours, setAbandonedCartHours] = useState(2);
  const [abandonedCartAutoReminder, setAbandonedCartAutoReminder] = useState(false);
  const [abandonedCartReminderHours, setAbandonedCartReminderHours] = useState(1);
  const [abandonedCartAutoSecondReminder, setAbandonedCartAutoSecondReminder] = useState(false);
  const [abandonedCartSecondReminderHours, setAbandonedCartSecondReminderHours] = useState(24);
  const [abandonedCartDiscountPercent, setAbandonedCartDiscountPercent] = useState(10);

  // Broadcast state (Phase 2)
  const [broadcastAudience, setBroadcastAudience] = useState("all");
  const [broadcastChannel, setBroadcastChannel] = useState("instagram");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);

  // Lazy supabase client - only created on the client side
  const getSupabase = () => createClient();

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase.from("accounts").select(SAFE_ACCOUNT_FIELDS).eq("id", user.id).single();
        if (data) {
          setAccount(data);
          setAutoGreeting(data.auto_greeting || false);
          setAutoGreetingMessage(data.auto_greeting_message || "");
          setGreetingPerChannel(data.greeting_per_channel || false);
          setInstagramGreeting(data.instagram_greeting || "");
          setFacebookGreeting(data.facebook_greeting || "");
          setWhatsappGreeting(data.whatsapp_greeting || "");
          setGreetingDelaySeconds(data.greeting_delay_seconds || 0);
          setAutoFollowUp(data.auto_follow_up_enabled || false);
          setAbandonedCartEnabled(data.abandoned_cart_enabled || false);
          setAbandonedCartHours(data.abandoned_cart_hours || 2);
          setAbandonedCartAutoReminder(data.abandoned_cart_auto_reminder || false);
          setAbandonedCartReminderHours(data.abandoned_cart_reminder_hours || 1);
          setAbandonedCartAutoSecondReminder(data.abandoned_cart_auto_second_reminder || false);
          setAbandonedCartSecondReminderHours(data.abandoned_cart_second_reminder_hours || 24);
          setAbandonedCartDiscountPercent(data.abandoned_cart_discount_percent || 10);
        }

        // Fetch quick replies
        const { data: qrData } = await supabase.from("quick_replies").select("*").eq("account_id", user.id).order("created_at");
        if (qrData) setQuickReplies(qrData);

        // Fetch FAQ count
        const { count } = await supabase.from("faqs").select("*", { count: "exact", head: true }).eq("account_id", user.id);
        setFaqCount(count || 0);
      } catch (err) {
        console.error("Automation page load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Helper: update account field
  const updateAccount = async (field, value) => {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("accounts").update({ [field]: value }).eq("id", user.id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("accounts").update({
        auto_greeting: autoGreeting,
        auto_greeting_message: autoGreetingMessage,
        greeting_per_channel: greetingPerChannel,
        instagram_greeting: instagramGreeting,
        facebook_greeting: facebookGreeting,
        whatsapp_greeting: whatsappGreeting,
        greeting_delay_seconds: greetingDelaySeconds,
        auto_follow_up_enabled: autoFollowUp,
        abandoned_cart_enabled: abandonedCartEnabled,
        abandoned_cart_hours: abandonedCartHours,
        abandoned_cart_auto_reminder: abandonedCartAutoReminder,
        abandoned_cart_reminder_hours: abandonedCartReminderHours,
        abandoned_cart_auto_second_reminder: abandonedCartAutoSecondReminder,
        abandoned_cart_second_reminder_hours: abandonedCartSecondReminderHours,
        abandoned_cart_discount_percent: abandonedCartDiscountPercent,
      }).eq("id", user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    }
    setSaving(false);
  };

  const handleSendFollowUps = async () => {
    setSendingFollowUps(true);
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/automation/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: user.id }),
      });
      const data = await res.json();
      toast.info(data.message || `Sent ${data.sent || 0} follow-up messages`);
    } catch (err) {
      toast.error("Failed to send follow-ups: " + err.message);
    }
    setSendingFollowUps(false);
  };

  const handleQuickReplySave = async () => {
    setQuickReplySaving(true);
    try {
      if (editingQuickReply) {
        const res = await fetch("/api/quick-replies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingQuickReply.id, ...newQuickReply }),
        });
        const data = await res.json();
        if (data.success) {
          setQuickReplies((prev) => prev.map(qr => qr.id === editingQuickReply.id ? data.quickReply : qr));
        }
      } else {
        const res = await fetch("/api/quick-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newQuickReply),
        });
        const data = await res.json();
        if (data.success) {
          setQuickReplies((prev) => [...prev, data.quickReply]);
        }
      }
      setShowAddQuickReply(false);
      setEditingQuickReply(null);
      setNewQuickReply({ title: "", content: "", category: "General", shortcut: "" });
    } catch (err) {
      console.error("Quick reply save error:", err);
    }
    setQuickReplySaving(false);
  };

  const handleQuickReplyDelete = async (id) => {
    if (!(await confirmAction("Delete this template?"))) return;
    await fetch(`/api/quick-replies?id=${id}`, { method: "DELETE" });
    setQuickReplies((prev) => prev.filter(q => q.id !== id));
  };

  const handleBroadcast = async () => {
    setBroadcastSending(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/automation/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: broadcastAudience,
          channel: broadcastChannel,
          message: broadcastMessage,
        }),
      });
      const data = await res.json();
      setBroadcastResult(data);
    } catch (err) {
      setBroadcastResult({ error: "Failed to send broadcast: " + err.message });
    }
    setBroadcastSending(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <h1>Automation</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? <><Check size={16} /> Saved!</> : saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      {/* Section 1: Auto-Greeting */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} style={{ color: "var(--accent-primary-light)" }} />
            Auto-Greeting
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          {/* Toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-lg)", background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)",
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Auto-Greeting</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                Automatically send a welcome message to new customers on their first message
              </div>
            </div>
            <div
              style={{ color: autoGreeting ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
              onClick={() => {
                const newVal = !autoGreeting;
                setAutoGreeting(newVal);
              }}
            >
              {autoGreeting ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </div>
          </div>

          {/* Greeting Configuration (shown when enabled) */}
          {autoGreeting && (
            <>
              {/* Default Greeting Message */}
              <div className="form-group" style={{ marginBottom: "var(--space-lg)" }}>
                <label className="form-label">Default Greeting Message</label>
                <textarea
                  className="form-input form-textarea"
                  value={autoGreetingMessage}
                  onChange={(e) => setAutoGreetingMessage(e.target.value)}
                  rows={3}
                  placeholder="Hi! Welcome to {business_name} 👋 How can I help you today?"
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Use {"{business_name}"} for your store name, {"{name}"} for the customer&apos;s name.
                </p>
              </div>

              {/* Greeting Delay */}
              <div className="form-group" style={{ marginBottom: "var(--space-lg)" }}>
                <label className="form-label">Greeting Delay (seconds)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={greetingDelaySeconds}
                    onChange={(e) => setGreetingDelaySeconds(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent-primary)" }}
                  />
                  <span style={{
                    minWidth: 50, textAlign: "center", fontWeight: 600,
                    fontSize: "var(--font-size-sm)", color: "var(--accent-primary)",
                  }}>
                    {greetingDelaySeconds}s
                  </span>
                </div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Wait before sending (0 = instant, max 30s)
                </p>
              </div>

              {/* Per-Channel Greeting Toggle */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--space-md)", background: "var(--bg-glass)",
                borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Custom Greetings Per Channel</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                    Set different greeting messages for Instagram, Facebook, and WhatsApp
                  </div>
                </div>
                <div
                  style={{ color: greetingPerChannel ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setGreetingPerChannel(!greetingPerChannel)}
                >
                  {greetingPerChannel ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
              </div>

              {/* Per-Channel Greeting Messages */}
              {greetingPerChannel && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      📷 Instagram Greeting
                    </label>
                    <textarea
                      className="form-input form-textarea"
                      value={instagramGreeting}
                      onChange={(e) => setInstagramGreeting(e.target.value)}
                      rows={3}
                      placeholder="Hey {name}! 👋 Welcome to {business_name} on Instagram!"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      🌐 Facebook Greeting
                    </label>
                    <textarea
                      className="form-input form-textarea"
                      value={facebookGreeting}
                      onChange={(e) => setFacebookGreeting(e.target.value)}
                      rows={3}
                      placeholder="Hi {name}! Welcome to {business_name}! How can we help?"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      📱 WhatsApp Greeting
                    </label>
                    <textarea
                      className="form-input form-textarea"
                      value={whatsappGreeting}
                      onChange={(e) => setWhatsappGreeting(e.target.value)}
                      rows={3}
                      placeholder="Hello {name}! 🙏 Thanks for messaging {business_name} on WhatsApp!"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              )}

              {/* Greeting Preview */}
              <div style={{
                padding: "var(--space-md)", background: "rgba(108, 92, 231, 0.05)",
                border: "1px solid rgba(108, 92, 231, 0.15)", borderRadius: "var(--radius-md)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "var(--accent-primary-light)", marginBottom: 6, textTransform: "uppercase" }}>Preview</div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {autoGreetingMessage
                    .replace(/\{business_name\}/g, account.business_name || "Sellora")
                    .replace(/\{name\}/g, "Ahmed")}
                </div>
                {greetingDelaySeconds > 0 && (
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                    ⏱ Sent after {greetingDelaySeconds}s delay
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section 2: Auto Follow-Up for Unpaid Orders */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} style={{ color: "var(--accent-orange)" }} />
            Auto Follow-Up for Unpaid Orders
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-lg)", background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)",
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Auto Follow-Up</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                Automatically send follow-up messages to customers with unpaid orders after 24 hours
              </div>
            </div>
            <div
              style={{ color: autoFollowUp ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
              onClick={() => setAutoFollowUp(!autoFollowUp)}
            >
              {autoFollowUp ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <button
              className="btn btn-secondary"
              disabled={sendingFollowUps}
              onClick={handleSendFollowUps}
            >
              {sendingFollowUps ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Clock size={16} /> Send Follow-Ups Now</>}
            </button>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
              Manually trigger follow-up messages for all unpaid orders older than 24 hours
            </p>
          </div>
        </div>
      </div>

      {/* Section 2.5: Abandoned Cart Recovery */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart size={18} style={{ color: "var(--accent-orange)" }} />
            Abandoned Cart Recovery
          </h3>
          <Link
            href="/dashboard/abandoned-carts"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              color: "var(--accent-primary)", fontWeight: 500,
              fontSize: "var(--font-size-sm)", textDecoration: "none",
            }}
          >
            View Carts <ChevronRight size={14} />
          </Link>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          {/* Main toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-lg)", background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)",
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Auto-Detect Abandoned Carts</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                Automatically detect when customers show purchase intent but don&apos;t complete their order
              </div>
            </div>
            <div
              style={{ color: abandonedCartEnabled ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
              onClick={() => setAbandonedCartEnabled(!abandonedCartEnabled)}
            >
              {abandonedCartEnabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </div>
          </div>

          {abandonedCartEnabled && (
            <>
              {/* Hours before marking as abandoned */}
              <div className="form-group" style={{ marginBottom: "var(--space-lg)" }}>
                <label className="form-label">Hours before marking as abandoned</label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <input
                    type="range"
                    min="1"
                    max="48"
                    value={abandonedCartHours}
                    onChange={(e) => setAbandonedCartHours(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent-orange)" }}
                  />
                  <span style={{
                    minWidth: 50, textAlign: "center", fontWeight: 600,
                    fontSize: "var(--font-size-sm)", color: "var(--accent-orange)",
                  }}>
                    {abandonedCartHours}h
                  </span>
                </div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  How long to wait after last customer activity before marking a cart as abandoned (default: 2 hours)
                </p>
              </div>

              {/* Auto-send first reminder */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--space-md)", background: "var(--bg-glass)",
                borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Auto-Send First Reminder</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                    Automatically send a follow-up message after the cart is abandoned
                  </div>
                </div>
                <div
                  style={{ color: abandonedCartAutoReminder ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setAbandonedCartAutoReminder(!abandonedCartAutoReminder)}
                >
                  {abandonedCartAutoReminder ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
              </div>

              {abandonedCartAutoReminder && (
                <div className="form-group" style={{ marginBottom: "var(--space-lg)", paddingLeft: "var(--space-md)" }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Delay after abandonment (hours)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                    <input
                      type="range"
                      min="1"
                      max="72"
                      value={abandonedCartReminderHours}
                      onChange={(e) => setAbandonedCartReminderHours(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--accent-primary)" }}
                    />
                    <span style={{
                      minWidth: 50, textAlign: "center", fontWeight: 600,
                      fontSize: "var(--font-size-sm)", color: "var(--accent-primary)",
                    }}>
                      {abandonedCartReminderHours}h
                    </span>
                  </div>
                </div>
              )}

              {/* Auto-send second reminder with discount */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "var(--space-md)", background: "var(--bg-glass)",
                borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Auto-Send Second Reminder with Discount</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                    Send a second follow-up with a special discount code to encourage purchase
                  </div>
                </div>
                <div
                  style={{ color: abandonedCartAutoSecondReminder ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
                  onClick={() => setAbandonedCartAutoSecondReminder(!abandonedCartAutoSecondReminder)}
                >
                  {abandonedCartAutoSecondReminder ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </div>
              </div>

              {abandonedCartAutoSecondReminder && (
                <div style={{ paddingLeft: "var(--space-md)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>Delay after first reminder (hours)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                        <input
                          type="range"
                          min="1"
                          max="168"
                          value={abandonedCartSecondReminderHours}
                          onChange={(e) => setAbandonedCartSecondReminderHours(Number(e.target.value))}
                          style={{ flex: 1, accentColor: "var(--accent-orange)" }}
                        />
                        <span style={{
                          minWidth: 50, textAlign: "center", fontWeight: 600,
                          fontSize: "var(--font-size-sm)", color: "var(--accent-orange)",
                        }}>
                          {abandonedCartSecondReminderHours}h
                        </span>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>Discount Percentage</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={abandonedCartDiscountPercent}
                          onChange={(e) => setAbandonedCartDiscountPercent(Number(e.target.value))}
                          style={{ flex: 1, accentColor: "var(--accent-green)" }}
                        />
                        <span style={{
                          minWidth: 50, textAlign: "center", fontWeight: 600,
                          fontSize: "var(--font-size-sm)", color: "var(--accent-green)",
                        }}>
                          {abandonedCartDiscountPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div style={{
                padding: "var(--space-md)", background: "rgba(255, 145, 0, 0.05)",
                border: "1px solid rgba(255, 145, 0, 0.15)", borderRadius: "var(--radius-md)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "var(--accent-orange)", marginBottom: 6, textTransform: "uppercase" }}>Abandoned Cart Flow</div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255, 145, 0, 0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--accent-orange)" }}>1</span>
                    Customer shows purchase intent but no order after <strong>{abandonedCartHours}h</strong>
                  </div>
                  {abandonedCartAutoReminder && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(108, 92, 231, 0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--accent-primary-light)" }}>2</span>
                      First reminder sent after <strong>{abandonedCartReminderHours}h</strong>
                    </div>
                  )}
                  {abandonedCartAutoSecondReminder && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0, 230, 118, 0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--accent-green)" }}>3</span>
                      Second reminder with <strong>{abandonedCartDiscountPercent}% discount</strong> after <strong>{abandonedCartSecondReminderHours}h</strong>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section 3: Sentiment Detection */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={18} style={{ color: "var(--accent-primary-light)" }} />
            Sentiment Detection
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{
            padding: "var(--space-lg)", background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
            display: "flex", gap: "var(--space-lg)", alignItems: "flex-start",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: "rgba(108, 92, 231, 0.1)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <AlertCircle size={24} style={{ color: "var(--accent-primary-light)" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Always Active</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                AI automatically detects negative or urgent messages and flags them with 🔴. 
                Urgent conversations are auto-escalated to &quot;In Progress&quot; status. 
                You can view escalated conversations in the <Link href="/dashboard/conversations" style={{ color: "var(--accent-primary)", fontWeight: 500 }}>Conversations</Link> page.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: FAQ Auto-Reply */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HelpCircle size={18} style={{ color: "var(--accent-green)" }} />
            FAQ Auto-Reply
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <div style={{
            padding: "var(--space-lg)", background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
            display: "flex", gap: "var(--space-lg)", alignItems: "flex-start",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: "rgba(0, 200, 83, 0.1)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <HelpCircle size={24} style={{ color: "var(--accent-green)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Smart FAQ Auto-Reply</div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: "var(--space-md)" }}>
                When customers ask questions that match your FAQ knowledge base, the AI will automatically 
                send the matching answer. You currently have <strong style={{ color: "var(--text-primary)" }}>{faqCount} FAQs</strong> in your knowledge base.
              </div>
              <Link
                href="/dashboard/settings?tab=faqs"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  color: "var(--accent-primary)", fontWeight: 500,
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <HelpCircle size={14} /> Manage FAQs in Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Broadcast / Bulk Messaging (Phase 2) */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Megaphone size={18} style={{ color: "var(--accent-orange)" }} />
            Broadcast / Bulk Messaging
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px",
              borderRadius: 6, background: "rgba(255, 152, 0, 0.1)",
              color: "var(--accent-orange)", textTransform: "uppercase",
            }}>
              Phase 2
            </span>
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          {!showBroadcast ? (
            <div style={{
              padding: "var(--space-2xl)", textAlign: "center",
              background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border-medium)",
            }}>
              <Megaphone size={40} style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }} />
              <h4 style={{ marginBottom: "var(--space-sm)" }}>Broadcast Messaging</h4>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-lg)", maxWidth: 400, margin: "0 auto var(--space-lg)" }}>
                Send bulk messages to your customers across Instagram, Facebook, and WhatsApp. Target specific segments or reach all customers at once.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowBroadcast(true)}>
                <Megaphone size={14} /> Try Broadcast
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
              {/* Target Audience */}
              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <select
                  className="form-input"
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                >
                  <option value="all">All Customers</option>
                  <option value="instagram">Instagram Customers</option>
                  <option value="facebook">Facebook Customers</option>
                  <option value="whatsapp">WhatsApp Customers</option>
                </select>
              </div>

              {/* Channel */}
              <div className="form-group">
                <label className="form-label">Channel</label>
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                  {[
                    { value: "instagram", label: "📷 Instagram", icon: Globe },
                    { value: "facebook", label: "🌐 Facebook", icon: Globe },
                    { value: "whatsapp", label: "📱 WhatsApp", icon: Smartphone },
                  ].map(ch => (
                    <button
                      key={ch.value}
                      className={`btn ${broadcastChannel === ch.value ? "btn-primary" : "btn-secondary"} btn-sm`}
                      onClick={() => setBroadcastChannel(ch.value)}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Composer */}
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-input form-textarea"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your broadcast message here... Use {name} for personalization."
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Use {"{name}"} for the customer&apos;s name, {"{business_name}"} for your store name.
                </p>
              </div>

              {/* Send Button */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <button
                  className="btn btn-primary"
                  disabled={broadcastSending || !broadcastMessage.trim()}
                  onClick={handleBroadcast}
                >
                  {broadcastSending ? <><Loader2 size={16} className="spin" /> Sending...</> : <><Send size={16} /> Send Broadcast</>}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowBroadcast(false)}>
                  Cancel
                </button>
              </div>

              {/* Broadcast Result */}
              {broadcastResult && (
                <div style={{
                  padding: "var(--space-md)", borderRadius: "var(--radius-md)",
                  background: broadcastResult.error ? "rgba(255, 82, 82, 0.1)" : "rgba(0, 200, 83, 0.1)",
                  border: `1px solid ${broadcastResult.error ? "rgba(255, 82, 82, 0.3)" : "rgba(0, 200, 83, 0.3)"}`,
                  fontSize: "var(--font-size-sm)",
                  color: broadcastResult.error ? "var(--accent-red)" : "var(--accent-green)",
                }}>
                  {broadcastResult.error
                    ? broadcastResult.error
                    : `Broadcast sent! ${broadcastResult.sent || 0} delivered, ${broadcastResult.failed || 0} failed.`
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 6: Quick Reply Templates */}
      <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={18} style={{ color: "var(--accent-primary-light)" }} />
            Quick Reply Templates
          </h3>
        </div>
        <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
          <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
            Save commonly used replies as templates. Type <code style={{ fontSize: 11, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4 }}>/{'{shortcut}'}</code> in chat to quickly insert a template. Use {"{name}"} and {"{business_name}"} for personalization.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-md)" }}>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setShowAddQuickReply(true);
              setEditingQuickReply(null);
              setNewQuickReply({ title: "", content: "", category: "General", shortcut: "" });
            }}>
              <Plus size={14} /> Add Template
            </button>
          </div>

          {/* Add/Edit Quick Reply Form */}
          {showAddQuickReply && (
            <div style={{
              padding: "var(--space-lg)", background: "var(--bg-glass)",
              borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)",
              border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Title</label>
                  <input
                    type="text" className="form-input" placeholder="e.g. Shipping Info"
                    value={newQuickReply.title}
                    onChange={(e) => setNewQuickReply({ ...newQuickReply, title: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Shortcut (optional)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>/</span>
                    <input
                      type="text" className="form-input" placeholder="e.g. ship"
                      value={newQuickReply.shortcut || ""}
                      onChange={(e) => setNewQuickReply({ ...newQuickReply, shortcut: e.target.value.replace(/^\/+/, '').replace(/\s/g, '') })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                    Type /{newQuickReply.shortcut || "shortcut"} in chat to use
                  </p>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Message Content</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="The actual reply message..."
                  value={newQuickReply.content}
                  onChange={(e) => setNewQuickReply({ ...newQuickReply, content: e.target.value })}
                  rows={3}
                />
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                  Variables: {"{name}"} = customer name, {"{business_name}"} = your store name
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={newQuickReply.category}
                  onChange={(e) => setNewQuickReply({ ...newQuickReply, category: e.target.value })}
                >
                  <option value="General">General</option>
                  <option value="Orders">Orders</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Returns">Returns</option>
                  <option value="Payment">Payment</option>
                  <option value="Greeting">Greeting</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={quickReplySaving || !newQuickReply.title || !newQuickReply.content}
                  onClick={handleQuickReplySave}
                >
                  {quickReplySaving ? "Saving..." : editingQuickReply ? "Update Template" : "Add Template"}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowAddQuickReply(false); setEditingQuickReply(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Quick Reply List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {quickReplies.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "var(--space-xl)" }}>
                No quick reply templates yet. Add your first one above!
              </p>
            ) : (
              quickReplies.map((qr) => (
                <div
                  key={qr.id}
                  style={{
                    padding: "var(--space-md)", background: "var(--bg-glass)",
                    borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Zap size={14} style={{ color: "var(--accent-primary-light)" }} />
                        <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{qr.title}</span>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: "var(--bg-glass)", color: "var(--text-tertiary)" }}>
                          {qr.category}
                        </span>
                        {qr.shortcut && (
                          <code style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 4,
                            background: "rgba(108,92,231,0.1)", color: "var(--accent-primary-light)",
                            fontFamily: "monospace",
                          }}>
                            /{qr.shortcut}
                          </code>
                        )}
                      </div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                        {qr.content}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginLeft: "var(--space-md)" }}>
                      <button
                        className="topbar-btn" title="Edit" style={{ width: 24, height: 24 }}
                        onClick={() => {
                          setEditingQuickReply(qr);
                          setShowAddQuickReply(true);
                          setNewQuickReply({
                            title: qr.title, content: qr.content,
                            category: qr.category || "General", shortcut: qr.shortcut || "",
                          });
                        }}
                      >
                        <Edit size={11} style={{ color: "var(--text-secondary)" }} />
                      </button>
                      <button
                        className="topbar-btn" title="Delete" style={{ width: 24, height: 24 }}
                        onClick={() => handleQuickReplyDelete(qr.id)}
                      >
                        <Trash2 size={11} style={{ color: "var(--accent-red)" }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
