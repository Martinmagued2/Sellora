"use client";

import { useState, useEffect } from "react";
import {
  CreditCard, Check, ArrowRight, Download, Shield,
  Zap, Star, Crown, ChevronRight, ExternalLink, Smartphone, Building2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

export default function BillingPage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState(null);
  const [usageStats, setUsageStats] = useState({ conversations: 0, aiReplies: 0, products: 0 });
  const [billingAddress, setBillingAddress] = useState({ street: "", city: "", state: "", postal_code: "", country: "EG" });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("accounts").select("*").eq("id", user.id).single();
        if (data) {
          setAccount(data);
          if (data.billing_address) setBillingAddress(data.billing_address);
        }

        // Fetch usage stats
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
          const [aiRes, convRes, prodRes, paymentRes] = await Promise.all([
            supabase.from("rate_limits").select("*", { count: "exact", head: true }).eq("email", user.id).eq("action", "ai_auto_reply").gte("created_at", oneDayAgo),
            supabase.from("conversations").select("id", { count: "exact", head: true }).eq("account_id", user.id).gte("created_at", thirtyDaysAgo),
            supabase.from("products").select("id", { count: "exact", head: true }).eq("account_id", user.id),
            supabase.from("payments").select("*").eq("account_id", user.id).order("created_at", { ascending: false }).limit(10),
          ]);
          setUsageStats({
            aiReplies: aiRes.count || 0,
            conversations: convRes.count || 0,
            products: prodRes.count || 0,
          });
          if (paymentRes.data) setInvoices(paymentRes.data);
        } catch (e) {}
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
                {(() => {
                  const limits = getPlanLimits(currentPlanName);
                  const maxConv = limits.conversations_per_month;
                  const convPercent = maxConv === -1 ? 0 : Math.min((usageStats.conversations / maxConv) * 100, 100);
                  const maxAi = limits.ai_replies_per_day;
                  const aiPercent = maxAi === -1 ? 0 : Math.min((usageStats.aiReplies / maxAi) * 100, 100);
                  return (
                    <>
                      <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, marginBottom: 4 }}>
                        {usageStats.conversations}<span style={{ fontSize: "var(--font-size-sm)", fontWeight: 400, color: "var(--text-tertiary)" }}> / {maxConv === -1 ? "∞" : maxConv} conversations</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)", marginTop: "var(--space-xs)", width: 280 }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${convPercent}%`, background: convPercent > 80 ? "var(--accent-orange)" : "var(--accent-gradient)" }} />
                      </div>
                      <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, marginTop: "var(--space-sm)", marginBottom: 4 }}>
                        {usageStats.aiReplies}<span style={{ fontSize: "var(--font-size-sm)", fontWeight: 400, color: "var(--text-tertiary)" }}> / {maxAi === -1 ? "∞" : maxAi} AI replies today</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-glass)", marginTop: "var(--space-xs)", width: 280 }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${aiPercent}%`, background: aiPercent > 80 ? "var(--accent-orange)" : "var(--accent-gradient)" }} />
                      </div>
                    </>
                  );
                })()}
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
                {showAddressForm ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    <input type="text" className="form-input" placeholder="Street address" value={billingAddress.street} onChange={(e) => setBillingAddress({ ...billingAddress, street: e.target.value })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                      <input type="text" className="form-input" placeholder="City" value={billingAddress.city} onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })} />
                      <input type="text" className="form-input" placeholder="State/Province" value={billingAddress.state} onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                      <input type="text" className="form-input" placeholder="Postal code" value={billingAddress.postal_code} onChange={(e) => setBillingAddress({ ...billingAddress, postal_code: e.target.value })} />
                      <input type="text" className="form-input" placeholder="Country" value={billingAddress.country} onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <button className="btn btn-primary btn-sm" disabled={addressSaving} onClick={async () => {
                        setAddressSaving(true);
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          await supabase.from('accounts').update({ billing_address: billingAddress }).eq('id', user.id);
                          setShowAddressForm(false);
                        } catch (err) { alert('Failed to save address'); }
                        finally { setAddressSaving(false); }
                      }}>{addressSaving ? 'Saving...' : 'Save Address'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowAddressForm(false)}>Cancel</button>
                    </div>
                  </div>
                ) : billingAddress.street ? (
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{billingAddress.street}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>{billingAddress.city}, {billingAddress.state} {billingAddress.postal_code}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>{billingAddress.country}</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddressForm(true)}>Edit Address</button>
                  </div>
                ) : (
                  <div style={{ padding: "var(--space-xl)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)", textAlign: "center", color: "var(--text-tertiary)" }}>
                    No billing address set.<br/>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)" }} onClick={() => setShowAddressForm(true)}>Add Address</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice History */}
          {invoices.length > 0 && (
            <div className="dashboard-panel" style={{ marginBottom: "var(--space-2xl)" }}>
              <div className="dashboard-panel-header"><h3>Payment History</h3></div>
              <div className="dashboard-panel-body" style={{ padding: 0 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Date</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Plan</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Amount</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, textTransform: "capitalize" }}>{inv.plan_purchased}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>{inv.amount} {inv.currency}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13 }}>
                          <span className={`status-badge ${inv.status === 'success' ? 'completed' : inv.status === 'pending' ? 'pending' : 'cancelled'}`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
