"use client";

import { Plus, Trash2, Lock, Loader2 } from "lucide-react";

export default function WebhooksTab({
  account, supabase,
  webhooks, setWebhooks,
  newWebhookUrl, setNewWebhookUrl,
  webhookSaving, setWebhookSaving,
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header"><h3>Webhook Integrations</h3></div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {account.plan === "starter" ? (
          <div style={{ textAlign: "center", padding: "var(--space-3xl) var(--space-xl)" }}>
            <Lock size={40} style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }} />
            <h3 style={{ marginBottom: "var(--space-sm)" }}>Webhooks are a Pro feature</h3>
            <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
              Connect Sellora to Shopify, Zapier, and other tools by upgrading to Professional.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/dashboard/billing'}>Upgrade Plan</button>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
              Receive real-time notifications when events happen (e.g., new order, new message). Sellora will POST a JSON payload to your URL.
            </p>

            {/* Add webhook */}
            <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
              <input type="url" className="form-input" placeholder="https://your-server.com/webhook" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" disabled={webhookSaving || !newWebhookUrl} onClick={async () => {
                setWebhookSaving(true);
                const { data: { user } } = await supabase.auth.getUser();
                const { data: newWh } = await supabase.from("account_webhooks").insert({
                  account_id: user.id,
                  url: newWebhookUrl,
                  events: ["order.created", "message.received"],
                }).select().single();
                if (newWh) setWebhooks([...webhooks, newWh]);
                setNewWebhookUrl("");
                setWebhookSaving(false);
              }}>
                {webhookSaving ? <Loader2 size={14} className="spin" /> : <><Plus size={14} /> Add</>}
              </button>
            </div>

            {/* List webhooks */}
            {webhooks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)" }}>
                No webhooks configured yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {webhooks.map((wh) => (
                  <div key={wh.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: 500, fontSize: "var(--font-size-sm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wh.url}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        Events: {wh.events?.join(", ")} • {wh.is_active ? <span style={{ color: "var(--accent-green)" }}>Active</span> : <span style={{ color: "var(--accent-red)" }}>Disabled</span>}
                        {wh.last_status_code ? ` • Last: ${wh.last_status_code}` : ""}
                      </div>
                    </div>
                    <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "none" }} onClick={async () => {
                      await supabase.from("account_webhooks").delete().eq("id", wh.id);
                      setWebhooks(webhooks.filter(w => w.id !== wh.id));
                    }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
