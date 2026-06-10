"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2, Key } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function Verify2FAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  // SECURITY FIX: Validate redirectTo is a safe relative path
  const getSafeRedirectTo = () => {
    const raw = searchParams.get("redirectTo") || "/dashboard";
    // Only allow relative paths that start with / and don't start with //
    if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
      return raw;
    }
    return "/dashboard";
  };

  useEffect(() => {
    const supabase = createClient();
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Check if user has 2FA enabled
      const { data: account } = await supabase
        .from("accounts")
        .select("totp_enabled")
        .eq("id", user.id)
        .single();

      if (!account?.totp_enabled) {
        // No 2FA needed, redirect to dashboard
        router.push(getSafeRedirectTo());
        return;
      }

      setUserId(user.id);
      setLoading(false);
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleVerify = async () => {
    const verifyCode = backupMode ? backupCode : code;

    if (!verifyCode || (backupMode ? verifyCode.length !== 9 : verifyCode.length !== 6)) {
      setError(backupMode ? "Please enter a valid backup code (XXXX-XXXX)" : "Please enter a 6-digit code");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // SECURITY FIX: No longer sending userId in the body — server always uses JWT
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: verifyCode,
          setupVerification: false,
          // SECURITY: userId is NO LONGER sent — server extracts from JWT
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      // SECURITY FIX: 2FA verification is now recorded server-side
      // (two_factor_verified_at column updated by the API).
      // No longer using sessionStorage for 2FA state.
      // The middleware checks two_factor_verified_at on every request.

      // Redirect to intended page
      router.push(getSafeRedirectTo());
    } catch (err) {
      setError("Verification failed. Please try again.");
    }
    setVerifying(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #0f0f1a)",
      }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary, #6c5ce7)" }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary, #0f0f1a)",
      padding: "var(--space-lg, 24px)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        padding: "var(--space-xl, 32px)",
        background: "var(--bg-card, #1a1a2e)",
        borderRadius: "var(--radius-xl, 16px)",
        border: "1px solid var(--border-medium, rgba(255,255,255,0.1))",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-xl, 32px)" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "var(--accent-gradient, linear-gradient(135deg, #6c5ce7, #a855f7))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-md, 16px)",
          }}>
            <Shield size={32} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Two-Factor Authentication</h1>
          <p style={{ color: "var(--text-tertiary, #888)", fontSize: 14 }}>
            {backupMode
              ? "Enter one of your backup codes to sign in"
              : "Enter the 6-digit code from your authenticator app"
            }
          </p>
        </div>

        {/* Code Input */}
        {!backupMode ? (
          <div style={{ marginBottom: "var(--space-lg, 24px)" }}>
            <div style={{
              display: "flex", gap: 8, justifyContent: "center",
              marginBottom: "var(--space-md, 16px)",
            }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  value={code[i] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const newCode = code.split("");
                    newCode[i] = val;
                    const updated = newCode.join("").slice(0, 6);
                    setCode(updated);
                    // Auto-focus next input
                    if (val && i < 5) {
                      const nextInput = e.target.parentElement?.children[i + 1];
                      if (nextInput) nextInput.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i] && i > 0) {
                      const prevInput = e.target.parentElement?.children[i - 1];
                      if (prevInput) prevInput.focus();
                    }
                    if (e.key === "Enter") handleKeyDown(e);
                  }}
                  style={{
                    width: 48, height: 56, textAlign: "center",
                    fontSize: 24, fontWeight: 700,
                    background: "var(--bg-glass, rgba(255,255,255,0.05))",
                    border: "1px solid var(--border-medium, rgba(255,255,255,0.1))",
                    borderRadius: "var(--radius-md, 8px)",
                    color: "var(--text-primary, white)",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--accent-primary, #6c5ce7)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border-medium, rgba(255,255,255,0.1))"}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "var(--space-lg, 24px)" }}>
            <input
              type="text"
              className="form-input"
              placeholder="XXXX-XXXX"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              style={{
                textAlign: "center", fontSize: 18, fontWeight: 700,
                letterSpacing: 2, fontFamily: "monospace",
              }}
              maxLength={9}
            />
          </div>
        )}

        {error && (
          <div style={{
            color: "var(--accent-red, #ff5252)", fontSize: 13,
            textAlign: "center", marginBottom: "var(--space-md, 16px)",
          }}>
            {error}
          </div>
        )}

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={verifying || (backupMode ? backupCode.length !== 9 : code.length !== 6)}
          style={{
            width: "100%", padding: "12px 24px",
            background: verifying ? "var(--bg-glass)" : "var(--accent-gradient, linear-gradient(135deg, #6c5ce7, #a855f7))",
            color: "white", border: "none",
            borderRadius: "var(--radius-md, 8px)",
            fontWeight: 600, fontSize: 15,
            cursor: verifying ? "not-allowed" : "pointer",
            opacity: verifying ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {verifying ? (
            <><Loader2 size={18} className="spin" /> Verifying...</>
          ) : (
            <><Key size={18} /> Verify</>
          )}
        </button>

        {/* Toggle backup mode */}
        <div style={{ textAlign: "center", marginTop: "var(--space-lg, 24px)" }}>
          <button
            onClick={() => { setBackupMode(!backupMode); setError(""); }}
            style={{
              background: "none", border: "none",
              color: "var(--accent-primary, #6c5ce7)",
              cursor: "pointer", fontSize: 13, textDecoration: "underline",
            }}
          >
            {backupMode ? "Use authenticator code instead" : "Use a backup code instead"}
          </button>
        </div>

        {/* Sign out */}
        <div style={{ textAlign: "center", marginTop: "var(--space-md, 16px)" }}>
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/");
            }}
            style={{
              background: "none", border: "none",
              color: "var(--text-tertiary, #888)",
              cursor: "pointer", fontSize: 12,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #0f0f1a)",
      }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary, #6c5ce7)" }} />
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  );
}
