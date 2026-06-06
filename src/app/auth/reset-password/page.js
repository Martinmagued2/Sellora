"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  Loader2,
  Shield,
} from "lucide-react";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const newPassword = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", minHeight: "100vh",
        background: "var(--bg-primary)",
      }}>
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)", padding: "var(--space-3xl)",
          maxWidth: 440, width: "90%", textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(0, 200, 83, 0.1)", border: "1px solid rgba(0, 200, 83, 0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-xl)",
            color: "var(--accent-green)",
          }}>
            <Check size={28} />
          </div>
          <h2 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--space-md)" }}>
            Password updated!
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xl)", lineHeight: 1.6 }}>
            Your password has been successfully changed. You can now log in with your new password.
          </p>
          <Link href="/login" className="btn btn-primary" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            width: "100%", justifyContent: "center",
          }}>
            Go to Login <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100%", minHeight: "100vh",
      background: "var(--bg-primary)",
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)", padding: "var(--space-3xl)",
        maxWidth: 440, width: "90%",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(108, 92, 231, 0.1)", border: "1px solid rgba(108, 92, 231, 0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto var(--space-lg)",
          color: "var(--accent-primary-light)",
        }}>
          <Shield size={24} />
        </div>

        <h1 style={{
          fontSize: "var(--font-size-2xl)", fontWeight: 800,
          marginBottom: "var(--space-sm)", textAlign: "center",
        }}>
          Set new password
        </h1>
        <p style={{
          color: "var(--text-secondary)", marginBottom: "var(--space-xl)",
          textAlign: "center", fontSize: "var(--font-size-sm)", lineHeight: 1.6,
        }}>
          Choose a strong password for your Sellora account
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

        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-tertiary)", pointerEvents: "none",
              }} />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-input"
                placeholder="Enter new password"
                onChange={handlePasswordChange}
                required
                style={{ paddingLeft: 36, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordStrength > 0 && (
              <div style={{ marginTop: 6 }}>
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
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-tertiary)", pointerEvents: "none",
              }} />
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                className="form-input"
                placeholder="Confirm new password"
                required
                style={{ paddingLeft: 36, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", padding: 4,
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{
            width: "100%", justifyContent: "center", marginTop: "var(--space-sm)",
          }}>
            {loading ? <><Loader2 size={16} className="spin" /> Updating password...</> : <>Update Password <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary-light)" }} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
