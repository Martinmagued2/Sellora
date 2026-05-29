"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, ShoppingBag, CreditCard } from "lucide-react";

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.orderId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // "success" | "failure" | null

  useEffect(() => {
    // Check if returning from Paymob with success/failure
    const success = searchParams.get("success");
    const pending = searchParams.get("pending");

    if (success === "true") {
      setPaymentStatus("success");
      setLoading(false);
      return;
    } else if (success === "false") {
      setPaymentStatus("failure");
      setLoading(false);
      return;
    }

    // Otherwise, fetch order and create checkout
    fetchOrderAndCheckout();
  }, [orderId]);

  const fetchOrderAndCheckout = async () => {
    try {
      // First, get the order details via a public API
      const orderRes = await fetch(`/api/paymob/order-status?orderId=${orderId}`);
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        setError(orderData.error || "Order not found");
        setLoading(false);
        return;
      }

      setOrder(orderData.order);

      // If already paid, show success
      if (orderData.order.payment_status === "paid") {
        setPaymentStatus("success");
        setLoading(false);
        return;
      }

      // Create Paymob checkout session
      setRedirecting(true);
      const checkoutRes = await fetch("/api/paymob/order-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setError(checkoutData.error || "Failed to create checkout");
        setLoading(false);
        setRedirecting(false);
        return;
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

  // Success state
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

  // Failure state
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
              background: "linear-gradient(135deg, #6c5ce7, #a855f7)", color: "white",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading/redirecting state
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
        {error ? (
          <>
            <XCircle size={64} style={{ color: "#ed4245", marginBottom: 16 }} />
            <h1 style={{ color: "white", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Error</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{error}</p>
          </>
        ) : (
          <>
            <Loader2 size={48} style={{ color: "#6c5ce7", marginBottom: 16, animation: "spin 1s linear infinite" }} />
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
                  <ShoppingBag size={16} style={{ color: "#6c5ce7" }} />
                  <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>{order.order_number}</span>
                </div>
                {(order.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                    <span>{item.qty}x {item.name}</span>
                    <span>{item.price * item.qty} EGP</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>Total</span>
                  <span style={{ color: "#3ba55d", fontWeight: 800, fontSize: 16 }}>{order.total} EGP</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
