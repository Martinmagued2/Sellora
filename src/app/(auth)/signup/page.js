"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Mail,
  Lock,
  User,
  Store,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  Star,
  TrendingUp,
  Clock,
  Loader2,
  Phone,
  Calendar,
  Gift,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [refCode, setRefCode] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  // Check for referral code in URL and localStorage
  useEffect(() => {
    // 🔧 Save invite token to localStorage so it survives the OAuth redirect
    if (inviteToken) {
      localStorage.setItem("sellora_invite_token", inviteToken);
    }
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) {
      localStorage.setItem("sellora_ref_code", refFromUrl);
      setRefCode(refFromUrl);
    } else {
      const stored = localStorage.getItem("sellora_ref_code");
      if (stored) setRefCode(stored);
    }
  }, [searchParams]);

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    let strength = 0;
    if (val.length >= 6) strength++;
    if (val.length >= 10) strength++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;
    setPasswordStrength(Math.min(strength, 4));
  };

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthClasses = ["", "weak", "weak", "medium", "strong"];

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const email = formData.get("email");
    const password = formData.get("password");
    const fullName = formData.get("fullName");
    const businessName = formData.get("businessName");
    const phone = formData.get("phone");
    const birthDate = formData.get("birthDate");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName,
          phone: phone,
          birth_date: birthDate,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    // If session exists → confirmed immediately → create account & go to dashboard
    // If no session → email confirmation required → show OTP screen
    if (data.session) {
      // User confirmed immediately (auto-confirm enabled) — create account record
      if (data.user) {
        await supabase.from("accounts").upsert({
          id: data.user.id,
          email,
          business_name: businessName || "My Store",
          owner_name: fullName,
          phone: phone,
          birth_date: birthDate || null,
          plan: "starter",
          plan_status: "trialing",
        }, { onConflict: "id" });

        // Track referral if code exists
        const storedRefCode = localStorage.getItem("sellora_ref_code");
        if (storedRefCode) {
          try {
            await fetch("/api/referrals/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                referralCode: storedRefCode,
                referredEmail: email,
                referredId: data.user.id,
              }),
            });
            localStorage.removeItem("sellora_ref_code");
          } catch (refErr) {
            console.error("Failed to track referral:", refErr);
          }
        }
      }
      router.push("/onboarding");
      router.refresh();
    } else {
      // Email confirmation required — show OTP screen
      // Account will be created after successful OTP verification
      setSuccessEmail(email);
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    // Before redirecting, save referral code to a cookie so the server callback can read it
    const storedRefCode = localStorage.getItem("sellora_ref_code");
    if (storedRefCode) {
      document.cookie = `sellora_ref_code=${storedRefCode}; path=/; max-age=86400; SameSite=Lax`;
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

  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSent, setResendSent] = useState(false);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown > 0]);

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: successEmail,
      token: otp,
      type: "signup",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    // Create account record after successful verification
    if (verifyData.user) {
      await supabase.from("accounts").upsert({
        id: verifyData.user.id,
        email: successEmail,
        business_name: verifyData.user.user_metadata?.business_name || "My Store",
        owner_name: verifyData.user.user_metadata?.full_name || "",
        phone: verifyData.user.user_metadata?.phone || null,
        birth_date: verifyData.user.user_metadata?.birth_date || null,
        plan: "starter",
        plan_status: "trialing",
      }, { onConflict: "id" });

      // Track referral if code exists
      const storedRefCode = localStorage.getItem("sellora_ref_code");
      if (storedRefCode) {
        try {
          await fetch("/api/referrals/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referralCode: storedRefCode,
              referredEmail: successEmail,
              referredId: verifyData.user.id,
            }),
          });
          localStorage.removeItem("sellora_ref_code");
        } catch (refErr) {
          console.error("Failed to track referral:", refErr);
        }
      }
    }

    router.push("/onboarding");
    router.refresh();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: successEmail,
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResendSent(true);
    setResendCooldown(60); // 60-second cooldown
    setTimeout(() => setResendSent(false), 3000);
  };

  return (
    <div className="auth-page">
      {/* Referral code indicator on OTP screen */}
      {success && refCode && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, padding: "8px 16px", borderRadius: "var(--radius-md)", background: "rgba(0, 230, 118, 0.1)", border: "1px solid rgba(0, 230, 118, 0.2)", color: "var(--accent-green)", fontSize: "var(--font-size-xs)", display: "flex", alignItems: "center", gap: 6 }}>
          <Gift size={14} /> Referral bonus pending
        </div>
      )}
      {/* Email confirmation success screen */}
      {success && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", minHeight: "100vh",
          background: "var(--bg-primary)",
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)", padding: "var(--space-3xl)",
            maxWidth: 480, width: "90%", textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(108, 92, 231, 0.1)", border: "1px solid rgba(108, 92, 231, 0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto var(--space-xl)",
              color: "var(--accent-primary-light)",
            }}>
              <MessageCircle size={28} />
            </div>
            <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--space-md)" }}>
              Verify your email
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
              We sent a 6-digit confirmation code to:
            </p>
            <p style={{ fontWeight: 700, color: "var(--accent-primary-light)", marginBottom: "var(--space-sm)" }}>
              {successEmail}
            </p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-xs)", marginBottom: "var(--space-xl)" }}>
              You can also click the confirmation link in the email to verify directly.
            </p>
            <div className="form-group" style={{ textAlign: "left", marginBottom: "var(--space-xl)" }}>
               <label className="form-label">Verification Code</label>
               <input 
                 type="text" 
                 className="form-input" 
                 placeholder="000000" 
                 maxLength={6} 
                 value={otp}
                 onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                 id="signup-otp" 
                 inputMode="numeric"
                 autoComplete="one-time-code"
                 style={{ textAlign: "center", fontSize: "var(--font-size-xl)", letterSpacing: 8 }}
               />
            </div>
            {error && <div style={{ color: "var(--accent-red)", marginBottom: "var(--space-md)", fontSize: "var(--font-size-sm)", padding: "10px", background: "rgba(255, 82, 82, 0.1)", borderRadius: "var(--radius-md)" }}>{error}</div>}
            <button className="btn btn-primary" onClick={handleVerifyOtp} disabled={loading || otp.length < 6} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
            <div style={{ marginTop: "var(--space-md)", textAlign: "center" }}>
              {resendSent ? (
                <p style={{ color: "var(--accent-green)", fontSize: "var(--font-size-sm)", fontWeight: 600 }}>New code sent!</p>
              ) : resendCooldown > 0 ? (
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>Resend code in {resendCooldown}s</p>
              ) : (
                <button 
                  onClick={handleResendOtp} 
                  style={{ 
                    background: "none", border: "none", color: "var(--accent-primary-light)", 
                    fontSize: "var(--font-size-sm)", fontWeight: 600, cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Resend verification code
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!success && (
      <>{/* ===== Brand Panel ===== */}
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
            Start selling on{" "}
            <span className="text-gradient-static">autopilot</span> in 10
            minutes
          </h2>

          <p className="auth-brand-desc">
            14-day free trial. No credit card required. Cancel anytime. See why
            thousands switched to Sellora.
          </p>

          <div className="auth-proof-cards">
            <div className="auth-proof-card">
              <div className="auth-proof-icon green"><Check size={20} /></div>
              <div className="auth-proof-text">
                No technical skills needed<br />
                <span>Set up in under 10 minutes — we guide every step</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon purple"><TrendingUp size={20} /></div>
              <div className="auth-proof-text">
                Average 3x increase in orders<br />
                <span>Our sellers grow fast with AI-powered automation</span>
              </div>
            </div>
            <div className="auth-proof-card">
              <div className="auth-proof-icon blue"><Clock size={20} /></div>
              <div className="auth-proof-text">
                Save 4+ hours every day<br />
                <span>Stop copy-pasting. Let AI handle repetitive work</span>
              </div>
            </div>
          </div>

          {/* Testimonial */}
          <div style={{
            padding: "var(--space-lg)", background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)",
          }}>
            <div style={{ display: "flex", gap: 3, marginBottom: "var(--space-sm)", color: "var(--accent-orange)" }}>
              {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p style={{
              fontSize: "var(--font-size-sm)", color: "var(--text-secondary)",
              lineHeight: 1.6, marginBottom: "var(--space-md)", fontStyle: "italic",
            }}>
              &quot;Sellora saved me 4 hours every day. My orders went up 3x in the first month.&quot;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", background: "var(--accent-gradient)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", fontWeight: 700,
              }}>NA</div>
              <div>
                <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600 }}>Nour Ahmed</div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Boutique Owner, Cairo</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Form Panel ===== */}
      <div className="auth-form-panel">
        <div className="auth-form-glow" />

        <div className="auth-card">
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Start your 14-day free trial — no credit card needed
          </p>

          {/* Referral code indicator */}
          {refCode && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.15)",
              color: "var(--accent-green)", fontSize: "var(--font-size-sm)",
              marginBottom: "var(--space-lg)", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Gift size={16} />
              Referred by a friend — you&apos;ll both get a bonus!
            </div>
          )}

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
            <button className="auth-social-btn google" id="google-signup" onClick={handleGoogleSignup}>
              <div className="auth-social-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              Sign up with Google
            </button>
          </div>

          <div className="auth-divider">or sign up with email</div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSignup}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input type="text" name="fullName" className="auth-input" placeholder="Your name" required id="signup-name" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <div className="auth-input-wrapper">
                  <Store size={16} className="auth-input-icon" />
                  <input type="text" name="businessName" className="auth-input" placeholder="Store name" required id="signup-business" />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="auth-input-wrapper">
                  <Phone size={16} className="auth-input-icon" />
                  <input type="tel" name="phone" className="auth-input" placeholder="+2010..." required id="signup-phone" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Birth Date</label>
                <div className="auth-input-wrapper">
                  <Calendar size={16} className="auth-input-icon" />
                  <input type="date" name="birthDate" className="auth-input" required id="signup-birthdate" />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input type="email" name="email" className="auth-input" placeholder="you@example.com" required id="signup-email" />
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
                  placeholder="Create a strong password"
                  onChange={handlePasswordChange}
                  required
                  id="signup-password"
                />
                <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordStrength > 0 && (
                <>
                  <div className="password-strength">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`password-strength-bar ${n <= passwordStrength ? `filled ${strengthClasses[passwordStrength]}` : ""}`} />
                    ))}
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                    Strength:{" "}
                    <span style={{
                      color: passwordStrength <= 2 ? "var(--accent-red)" : passwordStrength === 3 ? "var(--accent-orange)" : "var(--accent-green)",
                      fontWeight: 600,
                    }}>{strengthLabels[passwordStrength]}</span>
                  </div>
                </>
              )}
            </div>

            <div className="auth-submit">
              <button className="btn btn-primary" type="submit" disabled={loading} id="signup-submit">
                {loading ? <><Loader2 size={16} className="spin" /> Creating account...</> : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>

          <p className="auth-terms">
            By signing up, you agree to our <a href="mailto:support@sellora.app?subject=Terms of Service">Terms of Service</a> and <a href="mailto:support@sellora.app?subject=Privacy Policy">Privacy Policy</a>
          </p>

          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-primary)" }} />}>
      <SignupForm />
    </Suspense>
  );
}
