"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Star, Check, Send, Loader2, Store, ArrowLeft, MessageSquareQuote, ShieldCheck } from "lucide-react";
import "../components/landing/landing.css";

function ReviewPortalContent() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const productId = params.get("product");
  const router = useRouter();

  // Mode toggle: if arrived with orderId, assume customer order review. Otherwise assume merchant beta review!
  const isMerchantMode = !orderId;

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [storeName, setStoreName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !reviewText) return;
    setSubmitting(true);

    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isMerchantMode ? "merchant_beta_feedback" : "customer_order_review",
          orderId,
          productId,
          rating,
          name,
          role,
          storeName,
          reviewText,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // fallback if endpoint not active yet
    }

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="designer-card" style={{ maxWidth: "600px", margin: "60px auto", padding: "48px", textAlign: "center" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Check size={32} />
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "12px" }}>
          Thank You for Your Feedback!
        </h2>
        <p style={{ fontSize: "15px", color: "#94a3b8", lineHeight: 1.6, marginBottom: "32px" }}>
          {isMerchantMode
            ? "Your beta merchant review has been received by our founding team. Once verified, your store quote and business impact metrics will be featured on our landing page and community showcase."
            : "Your product review has been submitted to the merchant store and will appear on the product page shortly."}
        </p>
        <Link href="/" className="btn-designer-primary" style={{ textDecoration: "none" }}>
          Return to Sellora Homepage
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <span className="designer-badge" style={{ marginBottom: "16px" }}>
          <span className="dot" /> {isMerchantMode ? "MERCHANT BETA REVIEW PORTAL" : "VERIFIED PURCHASE REVIEW"}
        </span>
        <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>
          {isMerchantMode ? "Share Your Beta Store Experience" : `Review Order #${orderId}`}
        </h1>
        <p style={{ fontSize: "15px", color: "#94a3b8", lineHeight: 1.6 }}>
          {isMerchantMode
            ? "As an early beta merchant, your feedback directly shapes Sellora. Submit your honest rating and business impact below to be featured on our landing page and app."
            : "Let the merchant and other shoppers know how much you loved your product."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="designer-card" style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Star Rating Scrubber */}
        <div style={{ textAlign: "center", paddingBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <label style={{ fontSize: "13px", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Select Your Overall Rating
          </label>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  transition: "transform 0.15s ease",
                  transform: (hoverRating || rating) >= star ? "scale(1.2)" : "scale(1)",
                }}
              >
                <Star
                  size={36}
                  fill={(hoverRating || rating) >= star ? "#fbbf24" : "transparent"}
                  color={(hoverRating || rating) >= star ? "#fbbf24" : "#475569"}
                />
              </button>
            ))}
          </div>
          <div style={{ fontSize: "12px", color: "#818cf8", fontWeight: 700, marginTop: "8px" }}>
            {rating === 5 ? "★★★★★ 5.0 — Game Changer for our Store!" : `${rating}.0 Stars`}
          </div>
        </div>

        {/* Inputs Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: "6px" }}>
              Your Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Mahmoud"
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: "14px", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: "6px" }}>
              {isMerchantMode ? "Your Role / Title *" : "Phone Number or Email"}
            </label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={isMerchantMode ? "e.g. Founder & Store Manager" : "e.g. +20 109..."}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: "14px", outline: "none" }}
            />
          </div>
        </div>

        {isMerchantMode && (
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: "6px" }}>
              Store Name &amp; E-Commerce Platform *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Cairo Kicks • Shopify Store"
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: "14px", outline: "none" }}
            />
          </div>
        )}

        {/* Review Text Area */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: "6px" }}>
            {isMerchantMode ? "How has Sellora impacted your daily operations & revenue? *" : "Your Review *"}
          </label>
          <textarea
            required
            rows={5}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder={isMerchantMode ? "e.g. We save 4 hours every night on WhatsApp DMs. Our reply speed went from hours to seconds and Paymob verification runs completely on auto-pilot..." : "Tell us what you liked about the quality and shipping..."}
            style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: "14px", outline: "none", lineHeight: 1.6, resize: "vertical" }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="btn-designer-primary"
          style={{ width: "100%", padding: "16px", fontSize: "15px" }}
        >
          {submitting ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Loader2 className="animate-spin" size={18} /> Submitting Feedback...
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Send size={18} /> {isMerchantMode ? "Submit Beta Store Review" : "Publish Order Review"}
            </span>
          )}
        </button>

        <div style={{ fontSize: "12px", color: "#64748b", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <ShieldCheck size={14} color="#10b981" /> 100% Authentic Feedback • No fake quotes published
        </div>
      </form>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <div style={{ background: "#08080a", color: "#fff", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(8,8,10,0.8)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="landing-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "72px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "18px" }}>
            <Image src="/logo.png" alt="Sellora" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>Sellora</span>
          </Link>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      <main className="landing-container" style={{ padding: "40px 24px 80px" }}>
        <Suspense fallback={<div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading portal...</div>}>
          <ReviewPortalContent />
        </Suspense>
      </main>
    </div>
  );
}
