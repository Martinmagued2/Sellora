"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, Check, Send } from "lucide-react";

function ReviewForm() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const productId = params.get("product");

  const [order, setOrder] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId || !productId) {
      setError("Invalid review link");
      setLoading(false);
      return;
    }
    // We don't have a public order endpoint, but we can fetch the product info
    // from the public store endpoint if we knew the slug — for simplicity, just
    // show the form with the order ID embedded.
    setLoading(false);
  }, [orderId, productId]);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      setError("Please select a star rating");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          productId,
          rating,
          title: title || undefined,
          body: body || undefined,
          source: "whatsapp",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSubmitted(true);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(59,165,92,0.15)", color: "var(--accent-green)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Check size={32} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Thanks for your review!</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.5 }}>
            Your feedback helps us improve and helps other customers decide. We appreciate you taking the time. 🙏
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, textAlign: "center" }}>How was your experience?</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>
          Tap a star to rate. It takes 10 seconds.
        </p>

        {/* Star rating */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHoverRating(i)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 4, transition: "transform 0.1s ease",
                transform: (hoverRating >= i || rating >= i) ? "scale(1.1)" : "scale(1)",
              }}
            >
              <Star
                size={44}
                fill={(hoverRating >= i || rating >= i) ? "#f5b400" : "none"}
                color="#f5b400"
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience"
                maxLength={120}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, color: "#fff", fontSize: 14, outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
                Your review (optional)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell us more about your experience…"
                rows={4}
                maxLength={1000}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, color: "#fff", fontSize: 14, outline: "none", resize: "vertical",
                }}
              />
            </div>

            {error && (
              <div style={{ padding: 10, marginBottom: 12, background: "rgba(237,66,69,0.1)", border: "1px solid rgba(237,66,69,0.3)", borderRadius: 8, color: "#ed4245", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 10,
                background: "var(--accent-primary)", color: "#fff",
                fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              <Send size={14} /> {submitting ? "Submitting…" : "Submit review"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0b0f" }} />}>
      <ReviewForm />
    </Suspense>
  );
}
