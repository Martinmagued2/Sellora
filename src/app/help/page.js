"use client";

import { useState, useEffect } from "react";
import { Search, MessageCircle, ChevronRight, ArrowLeft } from "lucide-react";

export default function HelpPage() {
  const [faqs, setFaqs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFaq, setSelectedFaq] = useState(null);

  useEffect(() => {
    fetch("/api/faqs")
      .then(r => r.ok ? r.json() : { faqs: [] })
      .then(d => setFaqs(d.faqs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (f.question || "").toLowerCase().includes(q) || (f.answer || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 20px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.png" alt="Sellora" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Help Center</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>How can we help you?</p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <Search size={18} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px 14px 44px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, color: "#fff", fontSize: 15, outline: "none",
            }}
          />
        </div>

        {/* FAQ list / detail */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>Loading...</div>
        ) : selectedFaq ? (
          <div>
            <button onClick={() => setSelectedFaq(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 14 }}>
              <ArrowLeft size={16} /> Back to all articles
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{selectedFaq.question}</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.7 }}>{selectedFaq.answer}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
            <MessageCircle size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <p>{search ? "No articles match your search." : "No help articles yet."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(faq => (
              <button
                key={faq.id}
                onClick={() => setSelectedFaq(faq)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{faq.question}</span>
                <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Can't find what you're looking for? <a href="/dashboard/conversations" style={{ color: "#7E88F5" }}>Chat with us</a>
          </p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 8 }}>Powered by Sellora</p>
        </div>
      </div>
    </div>
  );
}
