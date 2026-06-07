"use client";

import { Clock, ToggleLeft, ToggleRight, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function AutomationTab({
  account, supabase,
  autoFollowUp, setAutoFollowUp,
  autoGreeting, setAutoGreeting,
  autoGreetingMessage, setAutoGreetingMessage,
  greetingPerChannel, setGreetingPerChannel,
  instagramGreeting, setInstagramGreeting,
  facebookGreeting, setFacebookGreeting,
  whatsappGreeting, setWhatsappGreeting,
  greetingDelaySeconds, setGreetingDelaySeconds,
}) {
  const toast = useToast();
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>Automation Settings</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {/* Auto-Greeting Toggle */}
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
          <div style={{ color: autoGreeting ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={async () => {
            const newVal = !autoGreeting;
            setAutoGreeting(newVal);
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("accounts").update({ auto_greeting: newVal }).eq("id", user.id);
          }}>
            {autoGreeting ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
          </div>
        </div>

        {/* Auto-Greeting Message Customization */}
        {autoGreeting && (
          <>
            <div className="form-group" style={{ marginBottom: "var(--space-lg)" }}>
              <label className="form-label">Default Greeting Message</label>
              <textarea
                className="form-input form-textarea"
                value={autoGreetingMessage}
                onChange={(e) => setAutoGreetingMessage(e.target.value)}
                onBlur={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase.from("accounts").update({ auto_greeting_message: autoGreetingMessage }).eq("id", user.id);
                }}
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
                  type="number"
                  className="form-input"
                  value={greetingDelaySeconds}
                  onChange={(e) => setGreetingDelaySeconds(Number(e.target.value))}
                  onBlur={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from("accounts").update({ greeting_delay_seconds: greetingDelaySeconds }).eq("id", user.id);
                  }}
                  min="0"
                  max="30"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                  Wait before sending (0 = instant, max 30s)
                </span>
              </div>
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
              <div style={{ color: greetingPerChannel ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={async () => {
                const newVal = !greetingPerChannel;
                setGreetingPerChannel(newVal);
                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from("accounts").update({ greeting_per_channel: newVal }).eq("id", user.id);
              }}>
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
                    onBlur={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      await supabase.from("accounts").update({ instagram_greeting: instagramGreeting }).eq("id", user.id);
                    }}
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
                    onBlur={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      await supabase.from("accounts").update({ facebook_greeting: facebookGreeting }).eq("id", user.id);
                    }}
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
                    onBlur={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      await supabase.from("accounts").update({ whatsapp_greeting: whatsappGreeting }).eq("id", user.id);
                    }}
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
              marginBottom: "var(--space-xl)",
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

        {/* Auto Follow-Up Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-lg)", background: "var(--bg-glass)",
          borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)",
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Auto Follow-Up for Unpaid Orders</div>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
              Automatically send follow-up messages to customers with unpaid orders after 24 hours
            </div>
          </div>
          <div style={{ color: autoFollowUp ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={async () => {
            const newVal = !autoFollowUp;
            setAutoFollowUp(newVal);
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("accounts").update({ auto_follow_up_enabled: newVal }).eq("id", user.id);
          }}>
            {autoFollowUp ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
          </div>
        </div>

        {/* Manual follow-up trigger */}
        <div style={{ marginTop: "var(--space-md)" }}>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              const res = await fetch("/api/automation/follow-up", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: user.id }),
              });
              const data = await res.json();
              toast.success(data.message || `Sent ${data.sent || 0} follow-up messages`);
            }}
          >
            <Clock size={16} /> Send Follow-Ups Now
          </button>
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
            Manually trigger follow-up messages for all unpaid orders older than 24 hours
          </p>
        </div>

        {/* Sentiment Detection Info */}
        <div style={{
          marginTop: "var(--space-xl)", padding: "var(--space-lg)",
          background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} style={{ color: "var(--accent-primary-light)" }} />
            Sentiment Detection
          </div>
          <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            AI automatically detects negative or urgent messages and flags them with 🔴. 
            Urgent conversations are auto-escalated to &ldquo;In Progress&rdquo; status. 
            You can view escalated conversations in the Conversations page.
          </div>
        </div>

        {/* FAQ Auto-Reply Info */}
        <div style={{
          marginTop: "var(--space-md)", padding: "var(--space-lg)",
          background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <HelpCircle size={16} style={{ color: "var(--accent-green)" }} />
            Smart FAQ Auto-Reply
          </div>
          <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
            When customers ask questions that match your FAQ knowledge base, the AI will automatically 
            send the matching answer. Go to the &ldquo;FAQ Knowledge Base&rdquo; tab to manage your FAQs.
          </div>
        </div>
      </div>
    </div>
  );
}
