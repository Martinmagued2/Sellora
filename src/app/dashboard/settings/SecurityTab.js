"use client";

import { useState } from "react";
import { Shield, Smartphone, Key, Loader2, Check, Copy, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "../components/ToastProvider";

export default function SecurityTab({
  account, supabase,
  passwords, setPasswords,
  passwordError, setPasswordError,
  passwordSuccess, setPasswordSuccess,
  updatingPassword, setUpdatingPassword,
  showDeleteConfirm, setShowDeleteConfirm,
  deleteConfirmText, setDeleteConfirmText,
}) {
  const toast = useToast();
  // 2FA state
  const [totpSetup, setTotpSetup] = useState(null); // { secret, qrUrl, otpauthUrl }
  const [totpCode, setTotpCode] = useState("");
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [totpError, setTotpError] = useState("");
  const [backupCodes, setBackupCodes] = useState(null); // array of codes shown after setup
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disableError, setDisableError] = useState("");
  const [codesCopied, setCodesCopied] = useState(false);

  const totpEnabled = account.totp_enabled;

  const handleUpdatePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!passwords.new || passwords.new.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.new });
    setUpdatingPassword(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess("Password updated successfully!");
      setPasswords({ new: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    }
  };

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const handleEnable2FA = async () => {
    setTotpError("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start 2FA setup");
      setTotpSetup(data);
    } catch (err) {
      setTotpError(err.message);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setTotpError("Please enter a 6-digit code.");
      return;
    }
    setTotpVerifying(true);
    setTotpError("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: totpCode, setupVerification: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      // Success - 2FA is now enabled
      setBackupCodes(data.backupCodes || []);
      setTotpSetup(null);
      setTotpCode("");
      // Update account state
      if (account && account.id) {
        // Reload account to reflect totp_enabled
        const { data: updatedAccount } = await supabase.from("accounts").select("totp_enabled").eq("id", account.id).single();
        if (updatedAccount) {
          Object.assign(account, updatedAccount);
        }
      }
      window.location.reload();
    } catch (err) {
      setTotpError(err.message);
    }
    setTotpVerifying(false);
  };

  const handleDisable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      setDisableError("Please enter a 6-digit code.");
      return;
    }
    setDisabling2FA(true);
    setDisableError("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disable 2FA");
      setShowDisable2FA(false);
      setDisableCode("");
      window.location.reload();
    } catch (err) {
      setDisableError(err.message);
    }
    setDisabling2FA(false);
  };

  const copyBackupCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 2000);
    }
  };

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header"><h3>Security</h3></div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {/* Change Password */}
        <div className="form-group" style={{ maxWidth: 400 }}>
          <label className="form-label">Change Password</label>
          <input type="password" placeholder="New password (min 6 chars)" className="form-input" style={{ marginBottom: "var(--space-sm)" }}
            value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
          <input type="password" placeholder="Confirm new password" className="form-input" style={{ marginBottom: "var(--space-md)" }}
            value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />

          {passwordError && <div style={{ color: "var(--accent-red)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>{passwordError}</div>}
          {passwordSuccess && <div style={{ color: "var(--accent-green)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>{passwordSuccess}</div>}

          <button className="btn btn-secondary" onClick={handleUpdatePassword} disabled={updatingPassword}>
            {updatingPassword ? <Loader2 size={16} className="spin" /> : "Update Password"}
          </button>
        </div>

        {/* Two-Factor Authentication */}
        <div style={{ paddingTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)", marginTop: "var(--space-2xl)" }}>
          <h4 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={18} /> Two-Factor Authentication
          </h4>

          {/* 2FA Status & Toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
          }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {totpEnabled ? (
                  <><Check size={16} style={{ color: "var(--accent-green)" }} /> 2FA is currently enabled</>
                ) : (
                  <><AlertTriangle size={16} style={{ color: "var(--text-tertiary)" }} /> 2FA is currently disabled</>
                )}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                {totpEnabled
                  ? "Your account is protected with an authenticator app"
                  : "Add an extra layer of security to your account with TOTP authentication"
                }
              </div>
            </div>
            {totpEnabled ? (
              <button className="btn btn-secondary btn-sm" style={{ color: "var(--accent-red)" }} onClick={() => setShowDisable2FA(true)}>
                Disable 2FA
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleEnable2FA}>
                <Smartphone size={14} /> Enable 2FA
              </button>
            )}
          </div>

          {/* 2FA Setup Flow */}
          {totpSetup && (
            <div style={{
              marginTop: "var(--space-lg)", padding: "var(--space-xl)",
              background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
            }}>
              <h5 style={{ fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 6 }}>
                <Key size={16} /> Set Up Authenticator
              </h5>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-lg)", lineHeight: 1.6 }}>
                <strong>Step 1:</strong> Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
              </div>

              {/* QR Code */}
              <div style={{ textAlign: "center", marginBottom: "var(--space-lg)" }}>
                <div style={{ display: "inline-block", borderRadius: "var(--radius-md)", background: "white", padding: 16 }}>
                  <QRCodeSVG
                    value={totpSetup.otpauthUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Manual entry */}
              <div style={{
                padding: "var(--space-md)", background: "rgba(108,92,231,0.05)",
                border: "1px solid rgba(108,92,231,0.15)", borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-lg)",
              }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: "var(--accent-primary-light)", marginBottom: 6, textTransform: "uppercase" }}>
                  Manual Entry Key
                </div>
                <code style={{ fontSize: 13, fontFamily: "monospace", wordBreak: "break-all", color: "var(--text-secondary)" }}>
                  {totpSetup.secret}
                </code>
              </div>

              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-md)", lineHeight: 1.6 }}>
                <strong>Step 2:</strong> Enter the 6-digit code from your authenticator app to verify setup
              </div>

              {/* Verification code input */}
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ width: 150, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
                  maxLength={6}
                />
                <button className="btn btn-primary btn-sm" disabled={totpVerifying || totpCode.length !== 6} onClick={handleVerify2FA}>
                  {totpVerifying ? <Loader2 size={14} className="spin" /> : "Verify & Enable"}
                </button>
              </div>

              {totpError && (
                <div style={{ color: "var(--accent-red)", fontSize: "var(--font-size-sm)" }}>{totpError}</div>
              )}

              <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-sm)" }} onClick={() => { setTotpSetup(null); setTotpCode(""); setTotpError(""); }}>
                Cancel Setup
              </button>
            </div>
          )}

          {/* Backup Codes Display */}
          {backupCodes && (
            <div style={{
              marginTop: "var(--space-lg)", padding: "var(--space-xl)",
              background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: "var(--radius-md)",
            }}>
              <h5 style={{ fontWeight: 600, marginBottom: "var(--space-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={16} style={{ color: "var(--accent-green)" }} /> 2FA Enabled Successfully!
              </h5>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Save these backup codes in a safe place. You can use them to sign in if you lose access to your authenticator.
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xs)",
                padding: "var(--space-md)", background: "var(--bg-card)", borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-md)", fontFamily: "monospace", fontSize: 14,
              }}>
                {backupCodes.map((code, i) => (
                  <div key={i} style={{ padding: "4px 8px", textAlign: "center" }}>{code}</div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyBackupCodes}>
                {codesCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Codes</>}
              </button>
            </div>
          )}

          {/* Disable 2FA Flow */}
          {showDisable2FA && (
            <div style={{
              marginTop: "var(--space-lg)", padding: "var(--space-xl)",
              background: "rgba(255,82,82,0.05)", border: "1px solid rgba(255,82,82,0.2)",
              borderRadius: "var(--radius-md)",
            }}>
              <h5 style={{ fontWeight: 600, marginBottom: "var(--space-sm)", color: "var(--accent-red)" }}>
                Disable Two-Factor Authentication
              </h5>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Enter the current 6-digit code from your authenticator app to disable 2FA.
              </p>
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-start", marginBottom: "var(--space-sm)" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ width: 150, textAlign: "center", fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
                  maxLength={6}
                />
                <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.2)", color: "var(--accent-red)" }} disabled={disabling2FA || disableCode.length !== 6} onClick={handleDisable2FA}>
                  {disabling2FA ? <Loader2 size={14} className="spin" /> : "Disable 2FA"}
                </button>
              </div>
              {disableError && (
                <div style={{ color: "var(--accent-red)", fontSize: "var(--font-size-sm)" }}>{disableError}</div>
              )}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-sm)" }} onClick={() => { setShowDisable2FA(false); setDisableCode(""); setDisableError(""); }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div style={{ paddingTop: "var(--space-xl)", marginTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)" }}>
          <h4 style={{ marginBottom: "var(--space-md)", color: "var(--accent-red)" }}>Danger Zone</h4>
          <div style={{
            padding: "var(--space-lg)", background: "rgba(255, 82, 82, 0.05)",
            border: "1px solid rgba(255, 82, 82, 0.15)", borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>Delete Account</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                Permanently delete your account and all data
              </div>
            </div>
            <button className="btn btn-sm" style={{ background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)" }} onClick={() => setShowDeleteConfirm(true)}>
              Delete Account
            </button>
          </div>
          {showDeleteConfirm && (
            <div style={{ marginTop: "var(--space-md)", padding: "var(--space-lg)", background: "rgba(255, 82, 82, 0.05)", border: "1px solid rgba(255, 82, 82, 0.2)", borderRadius: "var(--radius-md)" }}>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--accent-red)", marginBottom: "var(--space-md)" }}>
                This action is permanent and cannot be undone. Type <strong>DELETE</strong> to confirm.
              </p>
              <input type="text" className="form-input" placeholder='Type "DELETE" to confirm' value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} style={{ marginBottom: "var(--space-md)" }} />
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <button className="btn btn-sm" style={{ background: "rgba(255, 82, 82, 0.2)", color: "var(--accent-red)" }} disabled={deleteConfirmText !== "DELETE"} onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    // Delete all account data
                    await supabase.from('account_webhooks').delete().eq('account_id', user.id);
                    await supabase.from('team_members').delete().eq('account_id', user.id);
                    await supabase.from('auto_replies').delete().eq('account_id', user.id);
                    await supabase.from('accounts').delete().eq('id', user.id);
                    await supabase.auth.signOut();
                    window.location.href = '/';
                  } catch (err) { toast.error('Failed to delete account: ' + err.message); }
                }}>Permanently Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
