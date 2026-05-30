"use client";

import Link from "next/link";
import {
  MessageCircle,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
  Shield,
  Lock,
  Key,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { resetPassword } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    formData.append("origin", window.location.origin);
    
    const result = await resetPassword(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="auth-page">
      {/* ===== Brand Panel ===== */}
      <div className="auth-brand">
        <div className="auth-brand-bg">
          <div className="auth-brand-glow-1" />
          <div className="auth-brand-glow-2" />
          <div className="auth-brand-grid" />
        </div>

        <div className="auth-brand-content">
          <Link href="/" className="auth-brand-logo">
            <img src="/logo.png" alt="Sellora" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>
              Sell<span className="text-gradient-static">ora</span>
            </span>
          </Link>

          <h2 className="auth-brand-headline">
            Don&apos;t worry, we&apos;ve got you{" "}
            <span className="text-gradient-static">covered</span>
          </h2>

          <p className="auth-brand-desc">
            We take security seriously. Your reset link will be sent via encrypted email and expires in 15 minutes.
          </p>

          <div className="auth-proof-cards">
            <div className="auth-proof-card">
              <div className="auth-proof-icon green"><Shield size={20} /></div>
              <div className="auth-proof-text">
                Bank-level encryption<br />
                <span>AES-256 encryption protects all your data</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon purple"><Lock size={20} /></div>
              <div className="auth-proof-text">
                Secure reset process<br />
                <span>One-time link that expires automatically</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon blue"><Key size={20} /></div>
              <div className="auth-proof-text">
                Optional 2FA available<br />
                <span>Add an extra layer of security after reset</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Form Panel ===== */}
      <div className="auth-form-panel">
        <div className="auth-form-glow" />

        <div className="auth-card">
          {!sent ? (
            <>
              <h1 className="auth-title">Reset your password</h1>
              <p className="auth-subtitle">
                Enter your email and we&apos;ll send you a secure reset link
              </p>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: "var(--radius-md)",
                  background: "rgba(255, 82, 82, 0.1)", border: "1px solid rgba(255, 82, 82, 0.2)",
                  color: "var(--accent-red)", fontSize: "var(--font-size-sm)",
                  marginBottom: "var(--space-lg)",
                }}>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      type="email"
                      name="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      required
                      id="reset-email"
                    />
                  </div>
                </div>

                <div className="auth-submit">
                  <button className="btn btn-primary" type="submit" disabled={loading} id="reset-submit">
                    {loading ? <><Loader2 size={16} className="spin" /> Sending...</> : <>Send Reset Link <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="auth-success">
              <div className="auth-success-icon">
                <Check size={32} />
              </div>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-subtitle" style={{ marginBottom: "var(--space-xl)" }}>
                We&apos;ve sent a password reset link to your email address.
                Check your inbox and spam folder.
              </p>
              <button className="btn btn-secondary" onClick={() => setSent(false)} style={{ width: "100%" }}>
                Try another email
              </button>
            </div>
          )}

          <p className="auth-footer">
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={14} /> Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
