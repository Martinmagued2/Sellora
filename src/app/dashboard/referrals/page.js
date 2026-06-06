"use client";

import { useState, useEffect } from "react";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Loader2,
  ArrowRight,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    conversions: 0,
    totalEarnings: 0,
    totalPaid: 0,
    pendingPayout: 0,
  });
  const [referralCredits, setReferralCredits] = useState(0);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  const fetchReferralData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get account referral code
      const { data: account } = await supabase
        .from("accounts")
        .select("referral_code, referral_credits")
        .eq("id", user.id)
        .single();

      if (account?.referral_code) {
        setReferralCode(account.referral_code);
      } else {
        // Generate one
        const res = await fetch("/api/referrals", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setReferralCode(data.referralCode);
        }
      }

      if (account?.referral_credits) {
        setReferralCredits(parseFloat(account.referral_credits));
      }

      // Get referral stats and history
      const res = await fetch("/api/referrals");
      if (res.ok) {
        const data = await res.json();
        if (data.referralCode) setReferralCode(data.referralCode);
        if (data.referralCredits) setReferralCredits(parseFloat(data.referralCredits));
        if (data.stats) setStats(data.stats);
        if (data.referrals) setReferrals(data.referrals);
      }
    } catch (err) {
      console.error("Failed to fetch referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const referralLink = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${referralCode}`
    : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform) => {
    const text = `Join Sellora — the AI-powered e-commerce platform! Use my referral link:`;
    const url = referralLink;

    switch (platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
        break;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
        break;
      case "email":
        window.open(`mailto:?subject=${encodeURIComponent("Join Sellora!")}&body=${encodeURIComponent(text + "\n\n" + url)}`, "_blank");
        break;
    }
  };

  const handleRequestPayout = async () => {
    setPayoutLoading(true);
    setPayoutMsg("");
    // Simulate payout request — in production this would create a payout record
    setTimeout(() => {
      setPayoutMsg("Payout request submitted! We'll process it within 3-5 business days.");
      setPayoutLoading(false);
    }, 1500);
  };

  const statusColors = {
    pending: { bg: "rgba(255, 145, 0, 0.1)", color: "var(--accent-orange)" },
    signed_up: { bg: "rgba(0, 210, 255, 0.1)", color: "var(--accent-secondary)" },
    converted: { bg: "rgba(108, 92, 231, 0.1)", color: "var(--accent-primary-light)" },
    paid: { bg: "rgba(0, 230, 118, 0.1)", color: "var(--accent-green)" },
  };

  const statusLabels = {
    pending: "Pending",
    signed_up: "Signed Up",
    converted: "Converted",
    paid: "Paid",
  };

  if (loading) {
    return (
      <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>
        <Loader2 size={32} className="spin" />
        <p style={{ marginTop: "var(--space-md)" }}>Loading referrals...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Referral Program</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)", marginTop: "var(--space-xs)" }}>
            Earn commissions by referring other merchants to Sellora
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 24,
        padding: "var(--space-xl)",
        marginBottom: "var(--space-xl)",
      }}>
        <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--space-lg)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Gift size={20} style={{ color: "var(--accent-primary-light)" }} />
          How It Works
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-xl)" }}>
          {[
            {
              step: 1,
              title: "Share Your Link",
              desc: "Send your unique referral link to friends and fellow merchants",
              icon: Share2,
              color: "var(--accent-primary-light)",
              bg: "rgba(108, 92, 231, 0.1)",
            },
            {
              step: 2,
              title: "Friend Signs Up",
              desc: "They create a free account using your referral link",
              icon: Users,
              color: "var(--accent-secondary)",
              bg: "rgba(0, 210, 255, 0.1)",
            },
            {
              step: 3,
              title: "You Earn",
              desc: "Get $5 credit when they sign up, plus 10% of their first payment",
              icon: DollarSign,
              color: "var(--accent-green)",
              bg: "rgba(0, 230, 118, 0.1)",
            },
          ].map((item) => (
            <div key={item.step} style={{ textAlign: "center", position: "relative" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: item.bg, color: item.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto var(--space-md)", fontSize: "var(--font-size-xl)", fontWeight: 800,
              }}>
                {item.step}
              </div>
              <h4 style={{ fontWeight: 700, marginBottom: "var(--space-xs)", fontSize: "var(--font-size-base)" }}>{item.title}</h4>
              <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", lineHeight: 1.6 }}>{item.desc}</p>
              {item.step < 3 && (
                <ChevronRight size={20} style={{
                  position: "absolute", right: -16, top: 24,
                  color: "var(--text-tertiary)", opacity: 0.5,
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Referral Link Section */}
      <div style={{
        background: "linear-gradient(135deg, rgba(108, 92, 231, 0.08), rgba(0, 210, 255, 0.06))",
        border: "1px solid var(--border-accent)",
        borderRadius: 24,
        padding: "var(--space-xl)",
        marginBottom: "var(--space-xl)",
      }}>
        <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--space-md)" }}>Your Referral Link</h3>
        <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            flex: 1, minWidth: 280, padding: "12px 16px",
            background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)", color: "var(--accent-primary-light)",
            fontSize: "var(--font-size-sm)", fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}>
            {referralLink || "Generating..."}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCopy}
            style={{ gap: 6 }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", alignSelf: "center", marginRight: "var(--space-xs)" }}>Share via:</span>
          {[
            { platform: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
            { platform: "facebook", label: "Facebook", icon: Users, color: "#1877F2" },
            { platform: "twitter", label: "Twitter", icon: Share2, color: "#1DA1F2" },
            { platform: "email", label: "Email", icon: Mail, color: "var(--accent-orange)" },
          ].map((item) => (
            <button
              key={item.platform}
              onClick={() => handleShare(item.platform)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: "var(--radius-full)",
                background: `${item.color}15`, border: `1px solid ${item.color}30`,
                color: item.color, fontSize: "var(--font-size-xs)", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${item.color}25`; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${item.color}15`; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Referrals</span>
            <div className="stat-card-icon purple"><Users size={18} /></div>
          </div>
          <div className="stat-card-value">{stats.totalReferrals}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            People you&apos;ve referred
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Conversions</span>
            <div className="stat-card-icon blue"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-card-value">{stats.conversions}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {stats.totalReferrals > 0 ? Math.round((stats.conversions / stats.totalReferrals) * 100) : 0}% conversion rate
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Earnings</span>
            <div className="stat-card-icon green"><DollarSign size={18} /></div>
          </div>
          <div className="stat-card-value">${stats.totalEarnings.toFixed(2)}</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            ${stats.totalPaid.toFixed(2)} paid out
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Available Balance</span>
            <div className="stat-card-icon orange"><Wallet size={18} /></div>
          </div>
          <div className="stat-card-value" style={{ color: "var(--accent-green)" }}>
            ${(stats.pendingPayout + referralCredits).toFixed(2)}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-xs)" }}>
            {stats.pendingPayout + referralCredits >= 10 ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleRequestPayout}
                disabled={payoutLoading}
                style={{ marginTop: "var(--space-xs)", fontSize: "var(--font-size-xs)" }}
              >
                {payoutLoading ? <Loader2 size={12} className="spin" /> : <DollarSign size={12} />}
                {payoutLoading ? "Processing..." : "Request Payout"}
              </button>
            ) : (
              "Minimum $10 to request payout"
            )}
          </div>
          {payoutMsg && (
            <div style={{
              marginTop: "var(--space-sm)", padding: "8px 12px",
              background: "rgba(0, 230, 118, 0.1)", borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-xs)", color: "var(--accent-green)", fontWeight: 600,
            }}>
              {payoutMsg}
            </div>
          )}
        </div>
      </div>

      {/* Referral History Table */}
      <div className="dashboard-panel" style={{ marginTop: "var(--space-xl)" }}>
        <div className="dashboard-panel-header">
          <h3>Referral History</h3>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
            {referrals.length} referral{referrals.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="dashboard-panel-body" style={{ padding: 0 }}>
          {referrals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-tertiary)" }}>
              <Gift size={40} style={{ opacity: 0.3, marginBottom: "var(--space-md)" }} />
              <p style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>No referrals yet</p>
              <p style={{ fontSize: "var(--font-size-sm)" }}>Share your referral link to start earning commissions</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Referred User</th>
                  <th>Status</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id}>
                    <td style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
                      {new Date(ref.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--accent-gradient)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {(ref.referred_email || "?")[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: "var(--font-size-sm)" }}>
                          {ref.referred_email ? ref.referred_email.replace(/(.{2}).*(@.*)/, "$1***$2") : "Anonymous"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: statusColors[ref.status]?.bg || "var(--bg-glass)",
                        color: statusColors[ref.status]?.color || "var(--text-tertiary)",
                      }}>
                        {statusLabels[ref.status] || ref.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--accent-green)", fontSize: "var(--font-size-sm)" }}>
                      ${parseFloat(ref.commission_earned || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Commission Structure Info */}
      <div style={{
        marginTop: "var(--space-xl)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 24,
        padding: "var(--space-xl)",
      }}>
        <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: "var(--space-md)" }}>Commission Structure</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-lg)" }}>
          {[
            { label: "Sign-up Bonus", value: "$5.00", desc: "When your referral creates an account" },
            { label: "Conversion Bonus", value: "10%", desc: "Of their first subscription payment" },
            { label: "Minimum Payout", value: "$10.00", desc: "Request payout once you reach $10" },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "var(--space-lg)", background: "var(--bg-glass)",
              borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)",
            }}>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-primary-light)", marginBottom: "var(--space-xs)" }}>
                {item.value}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
