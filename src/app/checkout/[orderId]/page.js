"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, ShoppingBag, CreditCard, Tag, X, Check } from "lucide-react";

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.orderId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState(null); // { valid, discount_amount, coupon }
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // the successfully applied coupon
  const [discountedTotal, setDiscountedTotal] = useState(null);

  useEffect(() => {
    const success = searchParams.get("success");

    if (success === "true") {
      setPaymentStatus("success");
      setLoading(false);
      return;
    } else if (success === "false") {
      setPaymentStatus("failure");
      setLoading(false);
      return;
    }

    fetchOrderAndCheckout();
  }, [orderId]);

  const fetchOrderAndCheckout = async (couponToApply = null) => {
    try {
      const orderRes = await fetch(`/api/paymob/order-status?orderId=${orderId}`);
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        setError(orderData.error || "Order not found");
        setLoading(false);
        return;
      }

      setOrder(orderData.order);

      if (orderData.order.payment_status === "paid") {
        setPaymentStatus("success");
        setLoading(false);
        return;
      }

      // If there's already a coupon applied to this order, show it
      if (orderData.order.coupon_code) {
        setAppliedCoupon({
          code: orderData.order.coupon_code,
          discount_amount: orderData.order.discount_amount || 0,
        });
        setDiscountedTotal(orderData.order.total);
      }

      // Create Paymob checkout session
      setRedirecting(true);
      const checkoutRes = await fetch("/api/paymob/order-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          coupon_code: couponToApply?.code || null,
          discount_amount: couponToApply?.discount_amount || null,
        }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setError(checkoutData.error || "Failed to create checkout");
        setLoading(false);
        setRedirecting(false);
        return;
      }

      // If we applied a coupon, update the total display
      if (couponToApply && checkoutData.adjusted_total !== undefined) {
        setDiscountedTotal(checkoutData.adjusted_total);
      }

      // Redirect to Paymob iframe
      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      setRedirecting(false);
    }
  };

  // ─── Coupon validation ───
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);
    setCouponResult(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          order_total: order?.total,
          account_id: order?.account_id,
          items: order?.items,
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setCouponResult(data);

        // Now redeem the coupon
        const redeemRes = await fetch("/api/coupons/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: couponCode,
            order_id: orderId,
            order_total: order?.total,
            account_id: order?.account_id,
          }),
        });

        const redeemData = await redeemRes.json();

        if (redeemData.redeemed) {
          setAppliedCoupon({
            code: couponCode.trim().toUpperCase(),
            discount_amount: redeemData.discount_amount,
            type: redeemData.coupon.type,
            value: redeemData.coupon.value,
          });

          // Calculate discounted total
          const originalTotal = parseFloat(order?.total || 0);
          const discount = parseFloat(redeemData.discount_amount || 0);
          setDiscountedTotal(Math.max(0, originalTotal - discount));

          // Update order state locally
          setOrder(prev => ({
            ...prev,
            discount_amount: discount,
            coupon_code: couponCode.trim().toUpperCase(),
          }));
        } else {
          setCouponError(redeemData.error || "Failed to redeem coupon");
        }
      } else {
        setCouponError(data.error || "Invalid coupon");
      }
    } catch (err) {
      setCouponError("Failed to validate coupon");
    }

    setCouponLoading(false);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponResult(null);
    setCouponCode("");
    setDiscountedTotal(null);
    setCouponError(null);
  };

  // ─── Success state ───
  if (paymentStatus === "success") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 24,
          padding: "48px 40px", textAlign: "center", maxWidth: 420, width: "90%",
          border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
        }}>
          <CheckCircle size={64} style={{ color: "#3ba55d", marginBottom: 16 }} />
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Successful!</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6 }}>
            Your payment has been processed successfully. You will receive a confirmation message shortly.
          </p>
          {order && (
            <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase" }}>Order</div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>{order.order_number}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Failure state ───
  if (paymentStatus === "failure") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 24,
          padding: "48px 40px", textAlign: "center", maxWidth: 420, width: "90%",
          border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
        }}>
          <XCircle size={64} style={{ color: "#ed4245", marginBottom: 16 }} />
          <h1 style={{ color: "white", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Failed</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.6 }}>
            Your payment could not be processed. Please try again or contact the store for assistance.
          </p>
          <button
            onClick={() => { setPaymentStatus(null); setLoading(true); fetchOrderAndCheckout(); }}
            style={{
              marginTop: 24, padding: "12px 32px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #5865F2, #00D2FF)", color: "white",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading/checkout state ───
  const displayTotal = discountedTotal !== null ? discountedTotal : order?.total;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRadius: 24,
        padding: "48px 40px", textAlign: "center", maxWidth: 480, width: "90%",
        border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
      }}>
        {error ? (
          <>
            <XCircle size={64} style={{ color: "#ed4245", marginBottom: 16 }} />
            <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Error</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{error}</p>
          </>
        ) : (
          <>
            <Loader2 size={48} style={{ color: "#5865F2", marginBottom: 16, animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {redirecting ? "Redirecting to payment..." : "Preparing your checkout..."}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              {redirecting ? "You will be redirected to Paymob to complete your payment securely." : "Please wait while we prepare your order."}
            </p>

            {order && (
              <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <ShoppingBag size={16} style={{ color: "#5865F2" }} />
                  <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>{order.order_number}</span>
                </div>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    <span>{item.qty}x {item.name}</span>
                    <span>{item.price * item.qty} EGP</span>
                  </div>
                ))}

                {/* Coupon code input */}
                {!redirecting && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {appliedCoupon ? (
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px", background: "rgba(59,165,92,0.1)", borderRadius: 8,
                        border: "1px solid rgba(59,165,92,0.3)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Tag size={14} style={{ color: "#3ba55d" }} />
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "white", fontSize: 13 }}>{appliedCoupon.code}</span>
                          <span style={{ color: "#3ba55d", fontSize: 12, fontWeight: 600 }}>
                            -{appliedCoupon.discount_amount.toFixed(2)} EGP
                          </span>
                        </div>
                        <button
                          onClick={handleRemoveCoupon}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 2 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                          placeholder="Coupon code"
                          style={{
                            flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13,
                            fontFamily: "monospace", letterSpacing: "0.05em", outline: "none",
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          style={{
                            padding: "8px 16px", borderRadius: 8, border: "none",
                            background: couponLoading || !couponCode.trim() ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #5865F2, #00D2FF)",
                            color: "white", fontWeight: 600, fontSize: 12, cursor: couponLoading ? "wait" : "pointer",
                            opacity: couponLoading || !couponCode.trim() ? 0.5 : 1,
                          }}
                        >
                          {couponLoading ? <Loader2 size={14} className="spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#ed4245", display: "flex", alignItems: "center", gap: 4 }}>
                        <XCircle size={12} /> {couponError}
                      </div>
                    )}
                  </div>
                )}

                {/* Totals */}
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  {appliedCoupon && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Subtotal</span>
                      <span style={{ color: "rgba(255,255,255,0.5)", textDecoration: "line-through" }}>{order.total} EGP</span>
                    </div>
                  )}
                  {appliedCoupon && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                      <span style={{ color: "#3ba55d", display: "flex", alignItems: "center", gap: 4 }}>
                        <Tag size={12} /> Discount
                      </span>
                      <span style={{ color: "#3ba55d", fontWeight: 600 }}>-{appliedCoupon.discount_amount.toFixed(2)} EGP</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: appliedCoupon ? 8 : 0 }}>
                    <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Total</span>
                    <span style={{ color: "#3ba55d", fontWeight: 800, fontSize: 16 }}>{displayTotal} EGP</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
