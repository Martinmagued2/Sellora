"use client";

import { Plus, Edit, Trash2 } from "lucide-react";
import { useConfirm } from "../components/ConfirmProvider";

export default function FAQsTab({
  faqs, setFaqs,
  showAddFaq, setShowAddFaq,
  newFaq, setNewFaq,
  faqSaving, setFaqSaving,
  editingFaq, setEditingFaq,
  supabase,
}) {
  const confirmAction = useConfirm();

  /** Get auth headers with Bearer token for API calls */
  const getAuthHeaders = async () => {
    const headers = { "Content-Type": "application/json" };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      // Non-critical — cookie auth will be attempted as fallback
    }
    return headers;
  };

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <h3>FAQ Knowledge Base</h3>
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)" }}>
          Add frequently asked questions and answers. The AI will use these to auto-reply when customers ask similar questions.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-md)" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddFaq(true); setEditingFaq(null); setNewFaq({ question: "", answer: "", category: "General" }); }}>
            <Plus size={14} /> Add FAQ
          </button>
        </div>

        {showAddFaq && (
          <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-lg)", border: "1px solid var(--border-subtle)" }}>
            <div className="form-group">
              <label className="form-label">Question</label>
              <input type="text" className="form-input" placeholder="e.g. What are your shipping times?" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Answer</label>
              <textarea className="form-input form-textarea" placeholder="e.g. We ship within 2-3 business days across Egypt." value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newFaq.category} onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}>
                <option value="General">General</option>
                <option value="Shipping">Shipping</option>
                <option value="Returns">Returns</option>
                <option value="Payment">Payment</option>
                <option value="Store Hours">Store Hours</option>
                <option value="Location">Location</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button className="btn btn-primary btn-sm" disabled={faqSaving || !newFaq.question || !newFaq.answer} onClick={async () => {
                setFaqSaving(true);
                try {
                  const headers = await getAuthHeaders();
                  const res = await fetch("/api/faqs", {
                    method: editingFaq ? "PUT" : "POST",
                    headers,
                    body: JSON.stringify(editingFaq ? { id: editingFaq.id, ...newFaq } : newFaq),
                  });
                  const data = await res.json();
                  if (data.success) {
                    if (editingFaq) {
                      setFaqs((prev) => prev.map(f => f.id === editingFaq.id ? data.faq : f));
                    } else {
                      setFaqs((prev) => [data.faq, ...prev]);
                    }
                    setShowAddFaq(false);
                    setEditingFaq(null);
                    setNewFaq({ question: "", answer: "", category: "General" });
                  } else {
                    alert(data.error || "Failed to save FAQ");
                  }
                } catch (err) {
                  console.error("FAQ save error:", err);
                  alert("Failed to save FAQ");
                }
                setFaqSaving(false);
              }}>
                {faqSaving ? "Saving..." : editingFaq ? "Update FAQ" : "Add FAQ"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddFaq(false); setEditingFaq(null); }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {faqs.length === 0 ? (
            <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "var(--space-xl)" }}>No FAQs yet. Add your first FAQ to help the AI answer common questions.</p>
          ) : faqs.map((faq) => (
            <div key={faq.id} style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{faq.question}</div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", marginTop: 4 }}>{faq.answer}</div>
                  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: "var(--bg-glass)", color: "var(--text-tertiary)", marginTop: 4, display: "inline-block" }}>{faq.category}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="topbar-btn" title="Edit" style={{ width: 24, height: 24 }} onClick={() => { setEditingFaq(faq); setShowAddFaq(true); setNewFaq({ question: faq.question, answer: faq.answer, category: faq.category || "General" }); }}>
                    <Edit size={11} style={{ color: "var(--text-secondary)" }} />
                  </button>
                  <button className="topbar-btn" title="Delete" style={{ width: 24, height: 24 }} onClick={async () => {
                    if (!(await confirmAction("Delete this FAQ?"))) return;
                    try {
                      const headers = await getAuthHeaders();
                      const res = await fetch(`/api/faqs?id=${faq.id}`, {
                        method: "DELETE",
                        headers,
                      });
                      const data = await res.json();
                      if (data.success) {
                        setFaqs((prev) => prev.filter(f => f.id !== faq.id));
                      } else {
                        alert(data.error || "Failed to delete FAQ");
                      }
                    } catch (err) {
                      console.error("FAQ delete error:", err);
                      alert("Failed to delete FAQ");
                    }
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
