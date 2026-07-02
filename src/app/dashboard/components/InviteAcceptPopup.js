"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Check, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function InviteAcceptPopup() {
  const [show, setShow] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    const checkPendingInvite = async () => {
      const pendingInvite = localStorage.getItem("sellora_pending_invite");
      if (!pendingInvite) return;

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch the invite details
      try {
        const res = await fetch('/api/team/invite-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteId: pendingInvite }),
        });
        const data = await res.json();

        if (data.success && data.invite) {
          // Check if already accepted by this user
          if (data.invite.invite_status === 'accepted' && data.invite.user_id === user.id) {
            localStorage.removeItem("sellora_pending_invite");
            return;
          }

          // Check if invite is still pending
          if (data.invite.invite_status !== 'pending') {
            localStorage.removeItem("sellora_pending_invite");
            return;
          }

          setInviteInfo(data.invite);
          setShow(true);
        } else {
          localStorage.removeItem("sellora_pending_invite");
        }
      } catch (e) {
        console.error('[InvitePopup] Error:', e);
        localStorage.removeItem("sellora_pending_invite");
      }
    };

    // Small delay to let dashboard load
    const timer = setTimeout(checkPendingInvite, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: inviteInfo.id, userId: user.id }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({ success: true, message: `You've joined ${inviteInfo.business_name || "the team"} as ${inviteInfo.role || "agent"}!` });
        localStorage.removeItem("sellora_pending_invite");
        // Reload after 2 seconds to refresh data with new account context
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResult({ success: false, message: data.error || 'Failed to accept invitation' });
      }
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    localStorage.removeItem("sellora_pending_invite");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && handleReject()}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            style={{
              background: "var(--bg-card)", borderRadius: 20, padding: 32,
              maxWidth: 440, width: "calc(100% - 32px)",
              border: "1px solid var(--border-medium)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
            }}
          >
            {!result ? (
              <>
                {/* Icon */}
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(0,210,255,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <UserPlus size={32} color="var(--accent-primary)" />
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
                  Team Invitation
                </h2>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
                  You've been invited to join <strong style={{ color: "var(--text-primary)" }}>{inviteInfo?.business_name || "a team"}</strong> as an <strong style={{ color: "var(--accent-primary)" }}>{inviteInfo?.role || "agent"}</strong>.
                  <br />Accept to start managing conversations together.
                </p>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleReject}
                    style={{
                      flex: 1, padding: "12px 16px", borderRadius: 12,
                      background: "var(--bg-glass)", border: "1px solid var(--border-medium)",
                      color: "var(--text-secondary)", fontWeight: 600, fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleAccept}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "12px 16px", borderRadius: 12,
                      background: "var(--accent-gradient)", border: "none",
                      color: "white", fontWeight: 700, fontSize: 14,
                      cursor: loading ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? <><Loader2 size={16} className="spin" /> Accepting...</> : <><Check size={16} /> Accept</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Result */}
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: result.success ? "rgba(59,165,92,0.15)" : "rgba(255,82,82,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                  }}>
                    {result.success ? <Check size={32} color="#3BA55C" /> : <X size={32} color="#FF5252" />}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                    {result.success ? "Welcome to the team! 🎉" : "Failed"}
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                    {result.message}
                  </p>
                  {result.success && (
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      Redirecting to dashboard...
                    </p>
                  )}
                  {!result.success && (
                    <button onClick={() => setShow(false)} style={{
                      padding: "10px 20px", borderRadius: 10,
                      background: "var(--bg-glass)", border: "1px solid var(--border-medium)",
                      color: "var(--text-primary)", fontWeight: 600, cursor: "pointer",
                    }}>
                      Close
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
