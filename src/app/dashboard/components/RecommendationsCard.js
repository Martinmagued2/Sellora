"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Package, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REASON_LABELS = {
  "Frequently bought together": "🔗 Bought Together",
  "Similar category to your purchases": "📂 Similar Style",
  "Popular with similar customers": "👥 Popular",
  "Trending product": "📈 Trending",
  "Popular product": "🔥 Popular",
};

export default function RecommendationsCard({ customerId, onSendProduct }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const supabase = createClient();

  const fetchRecommendations = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, limit: 4 }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
      } else {
        setError(data.error || "Failed to load recommendations");
      }
    } catch (err) {
      setError("Failed to load recommendations");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: customerId, limit: 4 }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setRecommendations(data.recommendations || []);
        } else {
          setError(data.error || "Failed to load recommendations");
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load recommendations");
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div style={{
        padding: "var(--space-md)", borderRadius: "var(--radius-md)",
        background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
        marginTop: "var(--space-md)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>
          <Loader2 size={12} className="spin" /> Loading recommendations...
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) return null;

  return (
    <div style={{
      marginTop: "var(--space-md)", borderRadius: "var(--radius-md)",
      background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "var(--space-sm) var(--space-md)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--accent-secondary)" }}>
          <Sparkles size={12} /> Recommended for this customer
        </div>
        <button
          onClick={fetchRecommendations}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2 }}
          title="Refresh recommendations"
        >
          <Sparkles size={10} />
        </button>
      </div>
      <div style={{ padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: 4 }}>
        {recommendations.map((product, i) => (
          <div
            key={product.id || i}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: "var(--radius-sm)",
              background: "var(--bg-glass-hover)", cursor: "pointer",
              transition: "background 0.15s",
            }}
            onClick={() => onSendProduct?.(product)}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(108,92,231,0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-glass-hover)"}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-sm)",
              background: "var(--bg-tertiary)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              overflow: "hidden",
            }}>
              {product.image_urls?.[0] ? (
                <img src={product.image_urls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Package size={14} style={{ color: "var(--text-tertiary)" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {product.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary-light)" }}>
                  {product.price?.toLocaleString()} {product.currency || "EGP"}
                </span>
                {product.reason && (
                  <span style={{
                    fontSize: 9, padding: "0px 4px", borderRadius: 4,
                    background: "rgba(0,210,255,0.08)", color: "var(--accent-secondary)",
                    border: "1px solid rgba(0,210,255,0.15)",
                  }}>
                    {REASON_LABELS[product.reason] || product.reason}
                  </span>
                )}
              </div>
            </div>
            <Send size={10} style={{ color: "var(--accent-primary-light)", flexShrink: 0, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
