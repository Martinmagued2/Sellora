"use client";

import { useState, useEffect } from "react";
import {
  Star, Check, X, MessageSquare, Filter, Loader2,
  TrendingUp, AlertCircle,
} from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function ReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      const res = await fetch(`/api/reviews?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const moderate = async (id, action) => {
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(`Review ${action === "publish" ? "published" : action === "reject" ? "rejected" : "flagged"}`);
        load();
      } else {
        toast.error("Failed to update review");
      }
    } catch (e) {
      toast.error("Failed to update review");
    }
  };

  const reply = async (id, replyText) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      if (res.ok) {
        toast.success("Reply posted");
        load();
      }
    } catch (e) {
      toast.error("Failed to post reply");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-xl)" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: 4 }}>
          Reviews
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Moderate customer reviews collected via post-delivery WhatsApp requests.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          <StatCard label="Avg Rating" value={stats.avgRating ? `${stats.avgRating}★` : "—"} icon={<Star size={16} />} color="#f5b400" />
          <StatCard label="Published" value={stats.published} icon={<Check size={16} />} color="var(--accent-green)" />
          <StatCard label="Pending" value={stats.pending} icon={<AlertCircle size={16} />} color="var(--accent-orange)" />
          <StatCard label="Total" value={stats.total} icon={<MessageSquare size={16} />} color="var(--accent-primary)" />
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "pending", "published", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 8,
              background: filter === f ? "var(--accent-primary)" : "rgba(255,255,255,0.05)",
              color: filter === f ? "#fff" : "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-tertiary)" }}>
          <MessageSquare size={48} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p>No reviews yet. Reviews appear here automatically after customers receive their orders.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} onModerate={moderate} onReply={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color, fontSize: 12 }}>
        {icon}<span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ReviewCard({ review, onModerate, onReply }) {
  const [replyText, setReplyText] = useState(review.reply || "");
  const [showReply, setShowReply] = useState(false);

  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={12} fill={i <= review.rating ? "#f5b400" : "none"} color="#f5b400" />
            ))}
            <span style={{ color: "var(--text-tertiary)", fontSize: 12, marginLeft: 6 }}>
              by {review.customers?.name || "Anonymous"} · {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {review.products?.name || "Unknown product"}
          </div>
          {review.title && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{review.title}</div>}
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            {review.body || "No written review."}
          </p>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          background: review.status === "published" ? "rgba(59,165,92,0.15)" :
                     review.status === "pending" ? "rgba(245,180,0,0.15)" :
                     review.status === "rejected" ? "rgba(237,66,69,0.15)" : "rgba(255,255,255,0.05)",
          color: review.status === "published" ? "var(--accent-green)" :
                 review.status === "pending" ? "#f5b400" :
                 review.status === "rejected" ? "var(--accent-red)" : "var(--text-tertiary)",
        }}>
          {review.status}
        </span>
      </div>

      {review.reply && (
        <div style={{ marginTop: 10, padding: 10, background: "rgba(88,101,242,0.06)", borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--accent-primary-light)" }}>Your reply:</div>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>{review.reply}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {review.status === "pending" && (
          <>
            <button onClick={() => onModerate(review.id, "publish")} style={btnGreen}><Check size={12} /> Publish</button>
            <button onClick={() => onModerate(review.id, "reject")} style={btnRed}><X size={12} /> Reject</button>
          </>
        )}
        <button onClick={() => setShowReply(!showReply)} style={btnDefault}>
          <MessageSquare size={12} /> {review.reply ? "Edit Reply" : "Reply"}
        </button>
      </div>

      {showReply && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a public reply…"
            rows={2}
            style={{
              flex: 1, padding: 10, borderRadius: 8,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-primary)", fontSize: 13, resize: "vertical", outline: "none",
            }}
          />
          <button
            onClick={() => { onReply(review.id, replyText); setShowReply(false); }}
            style={{ ...btnGreen, alignSelf: "flex-start" }}
          >
            Post Reply
          </button>
        </div>
      )}
    </div>
  );
}

const btnGreen = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: "rgba(59,165,92,0.15)", color: "var(--accent-green)", border: "1px solid rgba(59,165,92,0.3)",
};

const btnRed = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: "rgba(237,66,69,0.15)", color: "var(--accent-red)", border: "1px solid rgba(237,66,69,0.3)",
};

const btnDefault = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)",
};
