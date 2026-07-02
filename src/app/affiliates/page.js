"use client";

import { useState } from "react";
import { TrendingUp, Users, DollarSign, Check, ArrowRight, Loader2 } from "lucide-react";

export default function AffiliatesPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", commission: 5 });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState(null);

  const handleSubmit = async () => {
    if (!form.name || !form.email) return;
    setLoading(true);
    try {
      // Use the public affiliates API
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.affiliate) {
        setAffiliateCode(data.affiliate.code);
        setSubmitted(true);
      } else {
        alert(data.error || "Failed to sign up");
      }
    } catch (e) {
      alert("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <img src="/logo.png" alt="Sellora" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>Sellora Affiliate Program</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
            Earn 5% commission on every order from customers you refer. Track your clicks, orders, and earnings in real-time.
          </p>
        </div>

        {submitted ? (
          /* Success state */
          <div style={{ textAlign: "center", padding: 40, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(59,165,92,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Check size={32} color="#3BA55C" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>You're in! 🎉</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 24 }}>Your affiliate code is:</p>
            <div style={{ display: "inline-block", padding: "12px 32px", borderRadius: 12, background: "linear-gradient(135deg, #5865F2, #00D2FF)", fontSize: 24, fontWeight: 800, letterSpacing: 2, marginBottom: 24 }}>
              {affiliateCode}
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>
              Share this link: <code style={{ color: "#7E88F5" }}>sellorachat.com?ref={affiliateCode}</code>
            </p>
            <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, background: "linear-gradient(135deg, #5865F2, #00D2FF)", color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
              Go to Dashboard <ArrowRight size={14} />
            </a>
          </div>
        ) : (
          <>
            {/* Benefits */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 40 }}>
              <BenefitCard icon={TrendingUp} title="5% Commission" desc="On every order from your referrals, for 30 days" color="#3BA55C" />
              <BenefitCard icon={Users} title="Track Everything" desc="Real-time dashboard with clicks, orders, and earnings" color="#5865F2" />
              <BenefitCard icon={DollarSign} title="Monthly Payouts" desc="Get paid via PayPal or bank transfer every month" color="#F8A532" />
            </div>

            {/* Signup form */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, maxWidth: 480, margin: "0 auto" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>Become an Affiliate</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="text" placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
                <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
                <div>
                  <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "block" }}>Commission Rate</label>
                  <select value={form.commission} onChange={e => setForm({ ...form, commission: parseFloat(e.target.value) })} style={inputStyle}>
                    <option value={5}>5% — Standard</option>
                    <option value={10}>10% — Partner</option>
                    <option value={15}>15% — VIP Influencer</option>
                  </select>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.name || !form.email}
                  style={{
                    padding: "14px 24px", borderRadius: 12,
                    background: "linear-gradient(135deg, #5865F2, #00D2FF)",
                    color: "#fff", border: "none", cursor: loading ? "wait" : "pointer",
                    fontSize: 15, fontWeight: 700,
                    opacity: loading || !form.name || !form.email ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 8,
                  }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Signing up...</> : <>Get Started <ArrowRight size={16} /></>}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 16 }}>
                By signing up, you agree to promote Sellora ethically. No spam.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, desc, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <Icon size={20} color={color} />
      </div>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px 0" }}>{title}</h4>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px",
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
};
