"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [status, setStatus] = useState("loading"); // loading, success, failed
  const [message, setMessage] = useState("Verifying your payment securely...");

  useEffect(() => {
    const merchantOrderId = searchParams.get("merchant_order_id") || searchParams.get("order");
    const isPaymobSuccessParam = searchParams.get("success");

    if (!merchantOrderId) {
      setStatus("failed");
      setMessage("Invalid callback parameters. No tracking ID found.");
      return;
    }

    if (isPaymobSuccessParam === "false") {
      setStatus("failed");
      setMessage("Payment was declined or cancelled.");
      return;
    }

    // Polling function to catch trailing webhooks
    const verifyStatus = async (attempts = 0) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Authentication lost. Please log in.");

        const res = await fetch(`/api/payments/verify-latest?merchant_order_id=${merchantOrderId}`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        });
        
        const data = await res.json();
        
        if (data.intent_status === "success") {
          setStatus("success");
          setMessage("Payment successful! Your account is now active.");
          return;
        }

        if (data.intent_status === "failed") {
          setStatus("failed");
          setMessage("Your transaction failed during processing.");
          return;
        }

        // If 'pending', the webhook hasn't processed yet. Try polling.
        if (data.intent_status === "pending") {
          if (attempts < 5) { // 5 tries, 10 seconds total wait
            setTimeout(() => verifyStatus(attempts + 1), 2000);
          } else {
            // Give up polling, but don't fail immediately - just tell user it's processing
            setStatus("success"); // optimistic UI
            setMessage("Payment received but processing is slightly delayed. You will be upgraded shortly.");
          }
        }
      } catch (err) {
        console.error("Verification error:", err);
        setStatus("failed");
        setMessage("An error occurred trying to verify the transaction.");
      }
    };

    verifyStatus();
  }, [searchParams, supabase]);

  return (
    <div style={{ padding: "var(--space-3xl) 0", display: "flex", justifyContent: "center" }}>
      <div className="glass-card" style={{ padding: "var(--space-2xl)", maxWidth: 500, width: "100%", textAlign: "center" }}>
        
        {status === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-lg)" }}>
            <Loader2 className="spinner" size={48} style={{ color: "var(--accent-primary)" }} />
            <h2>Verifying Transaction</h2>
            <p style={{ color: "var(--text-secondary)" }}>{message}</p>
          </div>
        )}

        {status === "success" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-lg)" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(0, 230, 118, 0.1)", color: "var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={40} />
            </div>
            <h2>Upgrade Complete!</h2>
            <p style={{ color: "var(--text-secondary)" }}>{message}</p>
            <button className="btn btn-primary" style={{ marginTop: "var(--space-md)" }} onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        )}

        {status === "failed" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-lg)" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255, 82, 82, 0.1)", color: "var(--accent-red)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={40} />
            </div>
            <h2>Transaction Failed</h2>
            <p style={{ color: "var(--text-secondary)" }}>{message}</p>
            <div style={{ display: "flex", gap: "var(--space-md)", width: "100%", marginTop: "var(--space-md)" }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.push('/dashboard')}>
                Home
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => router.push('/dashboard/billing')}>
                Try Again
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Loading secure callback route...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
