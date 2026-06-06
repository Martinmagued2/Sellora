"use client";

import { Bot, Plus, X, ToggleLeft, ToggleRight, Trash2, AlertTriangle } from "lucide-react";

export default function AutoRepliesTab({
  account, updateField, supabase,
  autoReplies, setAutoReplies,
  showAddReply, setShowAddReply,
  newReply, setNewReply,
  replySaving, setReplySaving,
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>AI Auto-Reply Settings</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {/* Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-lg)", background: "var(--bg-glass)",
          borderRadius: "var(--radius-md)", marginBottom: "var(--space-xl)",
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Enable AI Auto-Replies</div>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
              AI will automatically respond to common customer questions
            </div>
          </div>
          <div style={{ color: account.ai_enabled ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={() => updateField('ai_enabled', !account.ai_enabled)}>
            {account.ai_enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">AI Personality / Brand Voice</label>
          <textarea className="form-input form-textarea" value={account.ai_personality || ""} onChange={(e) => updateField('ai_personality', e.target.value)} placeholder="e.g. Friendly, professional, and helpful. Use emojis sparingly." />
        </div>

        {/* AI Escalation Notification Toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "var(--space-lg)", background: "var(--bg-glass)",
          borderRadius: "var(--radius-md)", marginTop: "var(--space-lg)",
          border: "1px solid var(--border-subtle)",
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} style={{ color: "#e74c3c" }} /> AI Escalation Alerts
            </div>
            <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
              Get notified when the AI can&apos;t handle a conversation and needs human intervention (angry customers, refund requests, complex issues)
            </div>
          </div>
          <div style={{ color: account.notify_escalations !== false ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={() => updateField('notify_escalations', account.notify_escalations === false)}>
            {account.notify_escalations !== false ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
          </div>
        </div>

        <div style={{ marginTop: "var(--space-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Quick Reply Templates</label>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReply(!showAddReply)}>
              <Plus size={14} /> Add Quick Reply
            </button>
          </div>

          {showAddReply && (
            <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: "var(--space-md)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                <input type="text" className="form-input" placeholder="Trigger keyword (e.g. 'hours')" value={newReply.keyword} onChange={(e) => setNewReply({ ...newReply, keyword: e.target.value })} />
                <select className="form-input" value={newReply.match_type} onChange={(e) => setNewReply({ ...newReply, match_type: e.target.value })} style={{ padding: "8px 12px" }}>
                  <option value="contains">Contains</option>
                  <option value="exact">Exact match</option>
                  <option value="starts_with">Starts with</option>
                </select>
              </div>
              <textarea className="form-input form-textarea" placeholder="Auto-reply message..." value={newReply.response} onChange={(e) => setNewReply({ ...newReply, response: e.target.value })} style={{ marginBottom: "var(--space-sm)" }} />
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <button className="btn btn-primary btn-sm" disabled={replySaving || !newReply.keyword || !newReply.response} onClick={async () => {
                  setReplySaving(true);
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    const { data: inserted } = await supabase.from('auto_replies').insert({
                      account_id: user.id, trigger_keyword: newReply.keyword,
                      response: newReply.response, match_type: newReply.match_type, is_active: true
                    }).select().single();
                    if (inserted) { setAutoReplies([...autoReplies, inserted]); setNewReply({ keyword: "", response: "", match_type: "contains" }); setShowAddReply(false); }
                  } catch (err) { alert('Failed to save: ' + err.message); }
                  finally { setReplySaving(false); }
                }}>{replySaving ? 'Saving...' : 'Save Reply'}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReply(false)}>Cancel</button>
              </div>
            </div>
          )}

          {autoReplies.length === 0 ? (
            <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-sm)" }}>
              No quick reply templates yet. Add one to auto-respond to common keywords.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {autoReplies.map((ar) => (
                <div key={ar.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>&ldquo;{ar.trigger_keyword}&rdquo;</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(108,92,231,0.1)", color: "var(--accent-primary)" }}>{ar.match_type}</span>
                    </div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ar.response}</div>
                  </div>
                  <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "none" }} onClick={async () => {
                    await supabase.from('auto_replies').delete().eq('id', ar.id);
                    setAutoReplies(autoReplies.filter(r => r.id !== ar.id));
                  }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
