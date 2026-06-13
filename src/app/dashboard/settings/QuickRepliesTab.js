"use client";

import { Zap, Plus, Edit, Trash2 } from "lucide-react";
import { useConfirm } from "../components/ConfirmProvider";

export default function QuickRepliesTab({
  supabase,
  quickReplies, setQuickReplies,
  showAddQuickReply, setShowAddQuickReply,
  newQuickReply, setNewQuickReply,
  quickReplySaving, setQuickReplySaving,
  editingQuickReply, setEditingQuickReply,
}) {
  const confirmAction = useConfirm();

  const getAuthHeaders = async () => {
    const headers = { "Content-Type": "application/json" };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    } catch (e) {}
    return headers;
  };
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>Quick Reply Templates</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
          Save commonly used replies as templates. Type <code style={{ fontSize: 11, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4 }}>/{'{shortcut}'}</code> in chat to quickly insert a template. Use {"{name}"} and {"{business_name}"} for personalization.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-md)" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddQuickReply(true); setEditingQuickReply(null); setNewQuickReply({ title: "", content: "", category: "General", shortcut: "" }); }}>
            <Plus size={14} /> Add Template
          </button>
        </div>

        {showAddQuickReply && (
          <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Title</label>
                <input type="text" className="form-input" placeholder="e.g. Shipping Info" value={newQuickReply.title} onChange={(e) => setNewQuickReply({ ...newQuickReply, title: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Shortcut (optional)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>/</span>
                  <input type="text" className="form-input" placeholder="e.g. ship" value={newQuickReply.shortcut || ""} onChange={(e) => setNewQuickReply({ ...newQuickReply, shortcut: e.target.value.replace(/^\/+/, '').replace(/\s/g, '') })} style={{ flex: 1 }} />
                </div>
                <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>Type /{newQuickReply.shortcut || "shortcut"} in chat to use</p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message Content</label>
              <textarea className="form-input form-textarea" placeholder="The actual reply message..." value={newQuickReply.content} onChange={(e) => setNewQuickReply({ ...newQuickReply, content: e.target.value })} rows={3} />
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                Variables: {"{name}"} = customer name, {"{business_name}"} = your store name
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newQuickReply.category} onChange={(e) => setNewQuickReply({ ...newQuickReply, category: e.target.value })}>
                <option value="General">General</option>
                <option value="Orders">Orders</option>
                <option value="Shipping">Shipping</option>
                <option value="Returns">Returns</option>
                <option value="Payment">Payment</option>
                <option value="Greeting">Greeting</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button className="btn btn-primary btn-sm" disabled={quickReplySaving || !newQuickReply.title || !newQuickReply.content} onClick={async () => {
                setQuickReplySaving(true);
                try {
                  const headers = await getAuthHeaders();
                  if (editingQuickReply) {
                    const res = await fetch("/api/quick-replies", {
                      method: "PUT",
                      headers,
                      body: JSON.stringify({ id: editingQuickReply.id, ...newQuickReply }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setQuickReplies((prev) => prev.map(qr => qr.id === editingQuickReply.id ? data.quickReply : qr));
                    }
                  } else {
                    const res = await fetch("/api/quick-replies", {
                      method: "POST",
                      headers,
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
                } catch (err) { console.error("Quick reply save error:", err); }
                setQuickReplySaving(false);
              }}>
                {quickReplySaving ? "Saving..." : editingQuickReply ? "Update Template" : "Add Template"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddQuickReply(false); setEditingQuickReply(null); }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {quickReplies.length === 0 ? (
            <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "var(--space-xl)" }}>No quick reply templates yet. Add your first one above!</p>
          ) : quickReplies.map((qr) => (
            <div key={qr.id} style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Zap size={14} style={{ color: "var(--accent-primary-light)" }} />
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{qr.title}</span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: "var(--bg-glass)", color: "var(--text-tertiary)" }}>{qr.category}</span>
                    {qr.shortcut && (
                      <code style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(108,92,231,0.1)", color: "var(--accent-primary-light)", fontFamily: "monospace" }}>/{qr.shortcut}</code>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{qr.content}</div>
                </div>
                <div style={{ display: "flex", gap: 4, marginLeft: "var(--space-md)" }}>
                  <button className="topbar-btn" title="Edit" style={{ width: 24, height: 24 }} onClick={() => {
                    setEditingQuickReply(qr);
                    setShowAddQuickReply(true);
                    setNewQuickReply({ title: qr.title, content: qr.content, category: qr.category || "General", shortcut: qr.shortcut || "" });
                  }}>
                    <Edit size={11} style={{ color: "var(--text-secondary)" }} />
                  </button>
                  <button className="topbar-btn" title="Delete" style={{ width: 24, height: 24 }} onClick={async () => {
                    if (!(await confirmAction("Delete this template?"))) return;
                    const headers = await getAuthHeaders();
                    await fetch(`/api/quick-replies?id=${qr.id}`, { method: "DELETE", headers });
                    setQuickReplies((prev) => prev.filter(q => q.id !== qr.id));
                  }}>
                    <Trash2 size={11} style={{ color: "var(--accent-red)" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
