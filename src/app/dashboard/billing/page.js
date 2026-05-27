"use client";

import { useState, useEffect } from "react";
import {
  CreditCard, Check, ArrowRight, Download, Shield,
  Zap, Star, Crown, ChevronRight, ExternalLink, Smartphone, Building2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function BillingPage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("accounts").select("plan").eq("id", user.id).single();
        if (data) setAccount(data);
      }
      setLoading(false);
    };
    fetchAccount();
  }, [supabase]);

  const handleSubscribe = async (planId) => {
    setPurchasingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");

      // Hard redirect to Paymob
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert("Billing Error: " + err.message);
      setPurchasingPlan(null);
    }
  };

  const plans = [
    {
      name: "starter",
      price: 499,
      currency: "EGP",
      color: "var(--accent-green)",
      features: [
        "1 connected channel",
        "25 products",
        "50 AI replies/day (Fast AI)",
        "100 conversations/mo",
        "30-day message history",
        "Basic analytics",
        "Email support",
      ],
    },
    {
      name: "professional",
      price: 1299,
      currency: "EGP",
      color: "var(--accent-primary-light)",
      popular: true,
      features: [
        "2 connected channels",
        "Unlimited products",
        "500 AI replies/day (Smart AI)",
        "1,000 conversations/mo",
        "6-month message history",
        "Full analytics dashboard",
        "Webhook integrations",
        "3 team members",
        "5 broadcast campaigns/mo",
        "Priority support",
      ],
    },
    {
      name: "business",
      price: 2999,
      currency: "EGP",
      color: "var(--accent-orange)",
      features: [
        "All 3 channels",
        "Unlimited everything",
        "Unlimited AI (Premium GPT-4o)",
        "Unlimited conversations",
        "Unlimited message history",
        "Full analytics + CSV export",
        "Webhook integrations",
        "Unlimited team members",
        "Unlimited campaigns",
        "Dedicated support",
      ],
    },
  ];

  const currentPlanName = account?.plan || "starter";
  const currentPlan = plans.find((p) => p.name === currentPlanName) || plans[0];

  return (
    <>
      <div className="page-header">
        <h1>Billing & Subscription</h1>
      </div>

      {loading ? (
        <div style={{ padding: "var(--space-3xl)", textAlign: "center", color: "var(--text-tertiary)" }}>Loading billing details...</div>
      ) : (
        <>
          {/* Current Plan */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border-accent)",
            borderRadius: "var(--radius-xl)", padding: "var(--space-xl)",
            marginBottom: "var(--space-xl)", position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "var(--accent-gradient)",
            }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)" }}>
                  <Crown size={20} style={{ color: "var(--accent-primary-light)" }} />
                  <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--accent-primary-light)", textTransform: "uppercase", letterSpacing: 1 }}>
                    Current Plan
                  </span>
                </div>
                <h2 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, marginBottom: "var(--space-xs)", textTransform: "capitalize" }}>
                  {currentPlan.name}
                </h2>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                  {currentPlan.price} {currentPlan.currency}/month
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>
                  This billing period
                </div>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800 }}>
                  0<span style={{ fontSize: "var(--font-size-sm)", fontWeight: 400, color: "var(--text-tertiary)" }}> / ∞ conversations</span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3, background: "var(--bg-glass)",
                  marginTop: "var(--space-sm)", width: 280,
                }}>
                  <div style={{
                    height: "100%", borderRadius: 3, width: "0%",
                    background: "var(--accent-gradient)",
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Plans Comparison */}
          <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Change Plan</h3>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-lg)", marginBottom: "var(--space-2xl)",
          }}>
            {plans.map((plan, i) => {
              const isCurrent = plan.name === currentPlanName;
              return (
                <div key={i} className="glass-card" style={{
                  padding: "var(--space-xl)",
                  borderColor: isCurrent ? "var(--accent-primary)" : undefined,
                  boxShadow: isCurrent ? "var(--shadow-glow)" : undefined,
                  position: "relative",
                }}>
                  {plan.popular && (
                    <div style={{ position: "absolute", top: "var(--space-md)", right: "var(--space-md)" }}>
                      <span className="badge badge-primary">Popular</span>
                    </div>
                  )}
                  <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: plan.color, marginBottom: "var(--space-sm)", textTransform: "capitalize" }}>
                    {plan.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: "var(--space-lg)" }}>
                    <span style={{ fontSize: "var(--font-size-4xl)", fontWeight: 900, lineHeight: 1 }}>{plan.price}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-secondary)" }}>{plan.currency}</span>
                    <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", marginLeft: 2 }}>/mo</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
                    {plan.features.map((f, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                        <Check size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                  <button 
                    className={`btn ${isCurrent ? "btn-secondary" : "btn-primary"}`} 
                    style={{ width: "100%" }} 
                    disabled={isCurrent || purchasingPlan === plan.name}
                    onClick={() => handleSubscribe(plan.name)}
                  >
                    {purchasingPlan === plan.name ? "Redirecting..." : isCurrent ? "Current Plan" : "Upgrade securely"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Egyptian Payment Methods Coming Soon */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3>Payment Methods</h3>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>
                  We securely process payments via Paymob. Supporting local Egyptian payment gateways directly.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ background: "rgba(0, 100, 255, 0.1)", color: "#0064ff", padding: 8, borderRadius: 8 }}><Building2 size={18} /></div>
                    <span style={{ fontWeight: 500 }}>Paymob (Cards & Wallets)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ background: "rgba(255, 204, 0, 0.1)", color: "#FFC107", padding: 8, borderRadius: 8 }}><Smartphone size={18} /></div>
                    <span style={{ fontWeight: 500 }}>Fawry</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", background: "var(--bg-glass)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ background: "rgba(156, 39, 176, 0.1)", color: "#9c27b0", padding: 8, borderRadius: 8 }}><Zap size={18} /></div>
                    <span style={{ fontWeight: 500 }}>Instapay</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3>Billing Address</h3>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                <div style={{ padding: "var(--space-xl)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)", textAlign: "center", color: "var(--text-tertiary)" }}>
                  No billing address set.<br/>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }} disabled>Add Address</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
