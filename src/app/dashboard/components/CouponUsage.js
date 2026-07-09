"use client";

import { useState, useEffect } from "react";
import { Tag, Percent, DollarSign, Truck, Check, X, Loader2, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TYPE_CONFIG = {
  percentage: { label: "Percentage Off", icon: <Percent size={14} />, color: "var(--accent-primary-light)", bg: "rgba(108, 92, 231, 0.12)" },
  fixed: { label: "Fixed Amount Off", icon: <DollarSign size={14} />, color: "var(--accent-green)", bg: "rgba(0, 230, 118, 0.12)" },
  free_shipping: { label: "Free Shipping", icon: <Truck size={14} />, color: "var(--accent-secondary)", bg: "rgba(0, 210, 255, 0.12)" },
};

/**
 * CouponUsage component for the conversation panel.
 * When a customer mentions a coupon code, this component shows
 * a small card with coupon details and a button to apply it.
 *
 * Props:
 * - code: string - The coupon code to look up
 * - accountId: string - The account ID to validate against
 * - orderTotal: number - Current order total (optional)
 * - onApply: function(coupon) - Callback when user applies the coupon
 * - onDismiss: function() - Callback to dismiss the card
 */
export default function CouponUsage({ code, accountId, orderTotal, onApply, onDismiss }) {
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;

    const validateCoupon = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            order_total: orderTotal,
            account_id: accountId,
          }),
        });

        const data = await res.json();
        if (data.valid) {
          setCoupon(data.coupon);
          setValid(true);
          setError(null);
        } else {
          setCoupon(null);
          setValid(false);
          setError(data.error || "Invalid coupon");
        }
      } catch (err) {
        setError("Failed to validate coupon");
        setValid(false);
      }
      setLoading(false);
    };

    validateCoupon();
  }, [code, accountId, orderTotal]);

  const handleCopy = () => {
    if (coupon?.code) {
      navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: "12px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--font-size-sm)",
        color: "var(--text-tertiary)",
      }}>
        <Loader2 size={14} className="spin" />
        Validating coupon "{code}"...
      </div>
    );
  }

  if (!valid) {
    return (
      <div style={{
        padding: "12px 16px",
        background: "rgba(255, 82, 82, 0.05)",
        border: "1px solid rgba(255, 82, 82, 0.2)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "var(--font-size-sm)",
        color: "var(--accent-red)",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <X size={14} /> <strong>{code}</strong> — {error}
        </span>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2 }}>
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  const typeConfig = TYPE_CONFIG[coupon.type] || TYPE_CONFIG.percentage;

  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--bg-card)",
      border: "1px solid var(--border-accent)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 2px 12px rgba(108, 92, 231, 0.1)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Tag size={16} style={{ color: "var(--accent-primary-light)" }} />
          <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Coupon Found</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Coupon details */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {/* Code badge */}
        <button
          onClick={handleCopy}
          style={{
            fontFamily: "monospace", fontSize: "var(--font-size-base)", fontWeight: 800,
            background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)", padding: "4px 10px", color: "var(--text-primary)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            letterSpacing: "0.05em",
          }}
          title="Click to copy"
        >
          {coupon.code}
          {copied ? <Check size={12} style={{ color: "var(--accent-green)" }} /> : <Copy size={12} style={{ color: "var(--text-tertiary)" }} />}
        </button>

        {/* Type badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: typeConfig.bg, color: typeConfig.color,
          border: `1px solid ${typeConfig.color}33`,
        }}>
          {typeConfig.icon} {typeConfig.label}
        </span>
      </div>

      {/* Value */}
      <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: 10 }}>
        {coupon.type === "percentage" && <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "var(--font-size-lg)" }}>{coupon.value}% OFF</span>}
        {coupon.type === "fixed" && <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "var(--font-size-lg)" }}>{parseFloat(coupon.value).toFixed(2)} EGP OFF</span>}
        {coupon.type === "free_shipping" && <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "var(--font-size-lg)" }}>Free Shipping</span>}
        {coupon.min_order_value > 0 && (
          <span style={{ marginLeft: 8, color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)" }}>
            (Min. {parseFloat(coupon.min_order_value).toFixed(2)} EGP)
          </span>
        )}
      </div>

      {/* Apply button */}
      {onApply && (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onApply(coupon)}
          style={{ width: "100%" }}
        >
          <Check size={14} /> Apply Coupon
        </button>
      )}
    </div>
  );
}
