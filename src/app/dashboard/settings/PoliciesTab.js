"use client";

import { Shield, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function PoliciesTab({
  supabase,
  policies, setPolicies,
  showAddPolicy, setShowAddPolicy,
  newPolicy, setNewPolicy,
  policySaving, setPolicySaving,
  editingPolicy, setEditingPolicy,
}) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>Business Policies</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)" }}>
          Add your store policies (returns, shipping, exchanges, etc.). The AI will use these to answer customer questions accurately — it will never make up policies that aren&apos;t defined here.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-md)" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddPolicy(true); setEditingPolicy(null); setNewPolicy({ title: "", content: "", category: "General" }); }}>
            <Plus size={14} /> Add Policy
          </button>
        </div>

        {showAddPolicy && (
          <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)", border: "1px solid var(--border-subtle)" }}>
            <div className="form-group">
              <label className="form-label">Policy Title</label>
              <input type="text" className="form-input" placeholder="e.g. Return & Refund Policy" value={newPolicy.title} onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Policy Content</label>
              <textarea className="form-input form-textarea" rows={5} placeholder="e.g. We accept returns within 14 days of delivery. Items must be unused and in original packaging. Refunds are processed within 5-7 business days." value={newPolicy.content} onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newPolicy.category} onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value })}>
                <option value="General">General</option>
                <option value="Returns & Refunds">Returns & Refunds</option>
                <option value="Shipping & Delivery">Shipping & Delivery</option>
                <option value="Exchange">Exchange</option>
                <option value="Payment">Payment</option>
                <option value="Privacy">Privacy</option>
                <option value="Terms of Service">Terms of Service</option>
                <option value="Warranty">Warranty</option>
                <option value="Cancellation">Cancellation</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button className="btn btn-primary btn-sm" disabled={policySaving || !newPolicy.title || !newPolicy.content} onClick={async () => {
                setPolicySaving(true);
                try {
                  const res = await fetch("/api/policies", {
                    method: editingPolicy ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editingPolicy ? { id: editingPolicy.id, ...newPolicy } : newPolicy),
                  });
                  const data = await res.json();
                  if (data.success) {
                    if (editingPolicy) {
                      setPolicies((prev) => prev.map(p => p.id === editingPolicy.id ? data.policy : p));
                    } else {
                      setPolicies((prev) => [data.policy, ...prev]);
                    }
                    setShowAddPolicy(false);
                    setEditingPolicy(null);
                    setNewPolicy({ title: "", content: "", category: "General" });
                  }
                } catch (err) { console.error("Policy save error:", err); }
                setPolicySaving(false);
              }}>
                {policySaving ? "Saving..." : editingPolicy ? "Update Policy" : "Add Policy"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddPolicy(false); setEditingPolicy(null); }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {policies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-xxl)" }}>
              <Shield size={32} style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }} />
              <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>No policies configured yet.</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>Add your return, shipping, and exchange policies so the AI can answer customer questions accurately.</p>
            </div>
          ) : policies.map((policy) => (
            <div key={policy.id} style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{policy.title}</span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: policy.is_active ? "rgba(16,185,129,0.1)" : "var(--bg-glass)", color: policy.is_active ? "var(--accent-green)" : "var(--text-tertiary)", display: "inline-block" }}>{policy.is_active ? "Active" : "Inactive"}</span>
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden", textOverflow: "ellipsis" }}>{policy.content}</div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: "rgba(108,92,231,0.1)", color: "var(--accent-primary-light)", marginTop: 6, display: "inline-block" }}>{policy.category}</span>
                </div>
                <div style={{ display: "flex", gap: 4, marginLeft: "var(--space-sm)" }}>
                  <button className="topbar-btn" title="Toggle active" style={{ width: 24, height: 24 }} onClick={async () => {
                    const newVal = !policy.is_active;
                    await fetch("/api/policies", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: policy.id, is_active: newVal }) });
                    setPolicies((prev) => prev.map(p => p.id === policy.id ? { ...p, is_active: newVal } : p));
                  }}>
                    {policy.is_active ? <ToggleRight size={13} style={{ color: "var(--accent-green)" }} /> : <ToggleLeft size={13} style={{ color: "var(--text-tertiary)" }} />}
                  </button>
                  <button className="topbar-btn" title="Edit" style={{ width: 24, height: 24 }} onClick={() => { setEditingPolicy(policy); setShowAddPolicy(true); setNewPolicy({ title: policy.title, content: policy.content, category: policy.category || "General" }); }}>
                    <Edit size={11} style={{ color: "var(--text-secondary)" }} />
                  </button>
                  <button className="topbar-btn" title="Delete" style={{ width: 24, height: 24 }} onClick={async () => {
                    if (!confirm("Delete this policy?")) return;
                    await fetch(`/api/policies?id=${policy.id}`, { method: "DELETE" });
                    setPolicies((prev) => prev.filter(p => p.id !== policy.id));
                  }}>
                    <Trash2 size={11} style={{ color: "var(--accent-red)" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Policy preview info */}
        {policies.length > 0 && (
          <div style={{ marginTop: "var(--space-lg)", padding: "var(--space-md)", background: "rgba(108,92,231,0.05)", border: "1px solid rgba(108,92,231,0.15)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: "var(--accent-primary-light)", marginBottom: 6, textTransform: "uppercase" }}>AI Training Info</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Your AI agent has been trained on <strong>{policies.filter(p => p.is_active).length} active polic{policies.filter(p => p.is_active).length === 1 ? "y" : "ies"}</strong>.
              When customers ask about returns, shipping, exchanges, or any policy-related topic, the AI will respond based on these policies — it will never make up information.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
