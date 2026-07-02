"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Bot,
  ShoppingBag,
  Zap,
  Loader2,
} from "lucide-react";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary-light)" }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get("redirect") || "/dashboard";
  const inviteToken = searchParams.get("invite");
  const ALLOWED_REDIRECTS = [
    "/dashboard",
    "/dashboard/analytics",
    "/dashboard/customers",
    "/dashboard/conversations",
    "/dashboard/settings",
    // "/settings" removed — use /dashboard/settings instead
    "/admin",
    "/admin/accounts",
    "/admin/conversations",
    "/admin/messages",
    "/admin/orders",
    "/admin/products",
    "/admin/ai-performance",
    "/admin/system",
    "/admin/broadcast",
  ];
  const redirectBase = rawRedirectTo.split("?")[0].split("#")[0];
  const redirectTo = ALLOWED_REDIRECTS.includes(redirectBase) ? rawRedirectTo : "/dashboard";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");

    // 🔧 Save invite token to localStorage BEFORE login (survives redirect)
    if (inviteToken) {
      localStorage.setItem("sellora_pending_invite", inviteToken);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect to dashboard — invite popup will show there
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: account } = await supabase.from("accounts").select("role").eq("id", user.id).maybeSingle();
      if (account && account.role === "admin") {
        router.push("/admin");
      } else {
        router.push(redirectTo);
      }
    } else {
      router.push(redirectTo);
    }
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    // 🔧 Save invite token to localStorage BEFORE Google redirect
    if (inviteToken) {
      localStorage.setItem("sellora_pending_invite", inviteToken);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
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
            Your DMs are about to become your{" "}
            <span className="text-gradient-static">best salesperson</span>
          </h2>

          <p className="auth-brand-desc">
            Join 2,500+ sellers who automated their WhatsApp, Instagram &amp; Facebook sales
            and never missed a midnight message again.
          </p>

          <div className="auth-proof-cards">
            <div className="auth-proof-card">
              <div className="auth-proof-icon purple"><Bot size={20} /></div>
              <div className="auth-proof-text">
                AI replied to 847 messages today<br />
                <span>Average response time: 0.8 seconds</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon green"><ShoppingBag size={20} /></div>
              <div className="auth-proof-text">
                89 new orders placed today<br />
                <span>$12,450 in revenue this month</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon blue"><Zap size={20} /></div>
              <div className="auth-proof-text">
                67% of conversations handled by AI<br />
                <span>Your team focuses on what matters</span>
              </div>
            </div>
          </div>

          <div className="auth-stats">
            <div>
              <div className="auth-stat-value text-gradient-static">2,500+</div>
              <div className="auth-stat-label">Active Sellers</div>
            </div>
            <div>
              <div className="auth-stat-value text-gradient-static">1.2M+</div>
              <div className="auth-stat-label">Messages Automated</div>
            </div>
            <div>
              <div className="auth-stat-value text-gradient-static">98%</div>
              <div className="auth-stat-label">Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Form Panel ===== */}
      <div className="auth-form-panel">
        <div className="auth-form-glow" />

        <div className="auth-card">
          <h1 className="auth-title">{inviteToken ? "Accept Team Invitation" : "Welcome back"}</h1>
          <p className="auth-subtitle">
            {inviteToken ? "Log in to accept your invitation and join the team" : "Log in to your dashboard and start selling"}
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

          {/* Google Button */}
          <div className="auth-social-row">
            <button className="auth-social-btn google" id="google-login" onClick={handleGoogleLogin}>
              <div className="auth-social-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              Continue with Google
            </button>
          </div>

          <div className="auth-divider">or continue with email</div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  name="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  required
                  id="login-email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="auth-input has-right-btn"
                  placeholder="Enter your password"
                  required
                  id="login-password"
                />
                <button
                  type="button"
                  className="auth-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-row">
              <label className="auth-remember">
                <input type="checkbox" defaultChecked />
                Remember me
              </label>
              <Link href="/forgot-password" className="auth-forgot">
                Forgot password?
              </Link>
            </div>

            <div className="auth-submit">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                id="login-submit"
              >
                {loading ? <><Loader2 size={16} className="spin" /> Logging in...</> : <>Log In <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/signup">Start free trial</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
