"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, Check, Send, Loader2 } from "lucide-react";

// Sellora logo — uses /public/logo.png (the actual brand asset)
function SelloraMark({ size = 40, withGlow = true }) {
  return (
    <img
      src="/logo.png"
      alt="Sellora"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        objectFit: "cover",
        boxShadow: withGlow ? "0 8px 24px -8px rgba(88, 101, 242, 0.5)" : "none",
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}

function ReviewForm() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const productId = params.get("product");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !productId) {
      setError("Invalid review link");
    }
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
          orderId, productId, rating,
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
      <div style={pageStyle}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={32} style={{ animation: "spin 0.8s linear infinite", color: "#5865F2" }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        {/* Decorative blobs */}
        <div style={{ ...blobStyle, top: "-100px", left: "10%", background: "radial-gradient(circle, rgba(59,165,92,0.3), transparent 70%)" }} />
        <div style={successCardStyle}>
          <div style={successIconStyle}>
            <Check size={36} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "20px 0 8px 0" }}>Thanks for your review!</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Your feedback helps us improve and helps other customers decide. We appreciate you taking the time. 🙏
          </p>
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8 }}>
            <SelloraMark size={24} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Powered by Sellora</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !orderId) {
    return (
      <div style={pageStyle}>
        <div style={errorCardStyle}>
          <div style={{ ...successIconStyle, background: "rgba(237,66,69,0.15)", color: "#ED4245" }}>
            !
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 8px 0" }}>Invalid link</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Decorative blobs */}
      <div style={{ ...blobStyle, top: "-50px", left: "10%", background: "radial-gradient(circle, rgba(88,101,242,0.25), transparent 70%)" }} />
      <div style={{ ...blobStyle, bottom: "-100px", right: "5%", background: "radial-gradient(circle, rgba(0,210,255,0.15), transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 1, padding: "40px 20px" }}>
        {/* Sellora branding */}
        <div style={{ textAlign: "center", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <SelloraMark size={36} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Sellora</span>
        </div>

        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, textAlign: "center" }}>How was your experience?</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginBottom: 32 }}>
            Tap a star to rate. It takes 10 seconds.
          </p>

          {/* Star rating */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  transition: "transform 0.15s ease",
                  transform: (hoverRating >= i || rating >= i) ? "scale(1.15)" : "scale(1)",
                }}
              >
                <Star
                  size={48}
                  fill={(hoverRating >= i || rating >= i) ? "#f5b400" : "none"}
                  color="#f5b400"
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summarize your experience"
                  maxLength={120}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Your review (optional)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Tell us more about your experience…"
                  rows={4}
                  maxLength={1000}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {error && (
                <div style={errorBannerStyle}>
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                style={submitBtnStyle}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Submitting…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit review
                  </>
                )}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <SelloraMark size={20} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Powered by Sellora</span>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 0.8s linear infinite", color: "#5865F2" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ReviewForm />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════

const pageStyle = {
  minHeight: "100vh",
  background: "#0a0b0f",
  color: "#fff",
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
};

const blobStyle = {
  position: "absolute",
  width: 400, height: 400,
  borderRadius: "50%",
  filter: "blur(80px)",
  pointerEvents: "none",
};

const cardStyle = {
  maxWidth: 440,
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 32,
  boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5)",
  backdropFilter: "blur(12px)",
};

const successCardStyle = {
  ...cardStyle,
  textAlign: "center",
};

const errorCardStyle = {
  ...cardStyle,
  textAlign: "center",
};

const successIconStyle = {
  width: 72, height: 72, borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(59,165,92,0.2), rgba(59,165,92,0.05))",
  border: "1px solid rgba(59,165,92,0.3)",
  color: "#3BA55C",
  display: "flex", alignItems: "center", justifyContent: "center",
  margin: "0 auto",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const errorBannerStyle = {
  padding: "12px 14px",
  marginBottom: 14,
  background: "rgba(237,66,69,0.1)",
  border: "1px solid rgba(237,66,69,0.3)",
  borderRadius: 10,
  color: "#ED4245",
  fontSize: 13,
};

const submitBtnStyle = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #5865F2 0%, #00D2FF 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 12px 32px -8px rgba(88, 101, 242, 0.5)",
  transition: "transform 0.15s ease",
};
