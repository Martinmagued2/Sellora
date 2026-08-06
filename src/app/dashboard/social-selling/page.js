'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, ShieldCheck, DollarSign, Zap, Link, 
  CheckCircle, Sliders, ShoppingBag, ArrowUpRight, Loader2
} from 'lucide-react';
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/ToastProvider";

export default function SocialSellingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [maxDiscount, setMaxDiscount] = useState(15);
  const [minMargin, setMinMargin] = useState(25);
  const [personality, setPersonality] = useState('friendly_negotiator');
  const [copiedLink, setCopiedLink] = useState(false);

  const sampleCheckoutLink = 'https://sellora.store/checkout/fast?bundle=silk_shirt&discount=HAGGLE12';

  useEffect(() => {
    const loadHaggleSettings = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('social_haggle_settings')
          .select('*')
          .limit(1)
          .single();

        if (data) {
          setIsEnabled(data.is_enabled ?? true);
          setMaxDiscount(data.max_discount_pct ?? 15);
          setMinMargin(data.min_margin_pct ?? 25);
          setPersonality(data.personality_style || 'friendly_negotiator');
        }
      } catch (err) {
        console.log("No existing haggle settings found, using defaults");
      } finally {
        setLoading(false);
      }
    };
    loadHaggleSettings();
  }, []);

  const handleSaveHaggleSettings = async (newEnabled, newMax, newMargin, newPersona) => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('social_haggle_settings').upsert({
        store_id: user.id,
        is_enabled: newEnabled,
        max_discount_pct: newMax,
        min_margin_pct: newMargin,
        personality_style: newPersona
      });

      toast?.info("Haggle settings updated live!");
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sampleCheckoutLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "var(--space-2xl)" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageSquare size={28} style={{ color: "var(--accent-green)" }} />
            Social Selling &amp; Dynamic Haggle Engine
          </h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 4 }}>
            Automated Conversational Negotiation Guardrails &amp; Instant WhatsApp / Instagram Checkout Cards
          </p>
        </div>
        <div className="page-header-actions">
          <button 
            onClick={() => {
              const nextVal = !isEnabled;
              setIsEnabled(nextVal);
              handleSaveHaggleSettings(nextVal, maxDiscount, minMargin, personality);
            }}
            className={`btn ${isEnabled ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Zap size={14} />
            Haggle Bot: {isEnabled ? 'ACTIVE' : 'PAUSED'}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-xl)" }}>
        {/* Guardrail Controls */}
        <div className="dashboard-panel" style={{ padding: "var(--space-xl)" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-lg)" }}>
            <Sliders size={18} style={{ color: "var(--accent-green)" }} />
            Merchant Dynamic Haggling Thresholds
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>
                <span>Maximum Allowed Dynamic Discount Cap</span>
                <span style={{ color: "var(--accent-green)", fontFamily: "monospace", fontSize: 14 }}>{maxDiscount}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="40" 
                value={maxDiscount} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMaxDiscount(val);
                  handleSaveHaggleSettings(isEnabled, val, minMargin, personality);
                }}
                style={{ width: "100%", accentColor: "var(--accent-green)" }}
              />
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>AI bot will never exceed this discount rate during WhatsApp / IG haggling.</p>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>
                <span>Minimum Required Profit Margin Guardrail</span>
                <span style={{ color: "var(--accent-green)", fontFamily: "monospace", fontSize: 14 }}>{minMargin}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="50" 
                value={minMargin} 
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMinMargin(val);
                  handleSaveHaggleSettings(isEnabled, maxDiscount, val, personality);
                }}
                style={{ width: "100%", accentColor: "var(--accent-green)" }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Negotiation Persona &amp; Strategy</label>
              <select
                value={personality}
                onChange={(e) => {
                  const val = e.target.value;
                  setPersonality(val);
                  handleSaveHaggleSettings(isEnabled, maxDiscount, minMargin, val);
                }}
                className="form-input"
              >
                <option value="strict">Strict (Firm Pricing, High Margin Defense)</option>
                <option value="friendly_negotiator">Friendly Negotiator (Balanced Discount for Fast Closes)</option>
                <option value="generous_closer">Generous Closer (Aggressive Conversions)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Simulation Preview */}
        <div className="dashboard-panel" style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-lg)" }}>
              <MessageSquare size={18} style={{ color: "var(--accent-primary-light)" }} />
              Live WhatsApp / DM Conversation Simulator
            </h3>

            <div style={{ background: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-md)", fontSize: 12 }}>
              <div style={{ background: "var(--bg-primary)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", maxWidth: "85%", color: "var(--text-secondary)" }}>
                Buyer: "Hey! Love the items. Can you give me a discount if I buy 2 today?"
              </div>
              <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.2)", padding: "var(--space-md)", borderRadius: "var(--radius-md)", maxWidth: "90%", marginLeft: "auto", color: "var(--text-primary)" }}>
                <div>
                  AI Bot ({personality}): "I can definitely help with that! If you bundle 2 items right now, I can unlock an exclusive <strong style={{ color: "var(--accent-green)" }}>{Math.min(maxDiscount, 12)}% discount</strong> for you!"
                </div>
                {/* 1-Tap Checkout Card Preview */}
                <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", padding: "var(--space-md)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ShoppingBag size={18} style={{ color: "var(--accent-green)" }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>2x Store Bundle</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}><span style={{ textDecoration: "line-through" }}>$178.00</span> → <strong style={{ color: "var(--accent-green)" }}>${(178 * (1 - Math.min(maxDiscount, 12) / 100)).toFixed(2)}</strong></div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "4px 8px" }}>
                    1-Tap Pay <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: "var(--space-md)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Dynamic 1-Tap Checkout Link Generator:</span>
              <button 
                onClick={handleCopyLink}
                style={{ background: "none", border: "none", color: "var(--accent-green)", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
              >
                {copiedLink ? <CheckCircle size={14} /> : <Link size={14} />}
                {copiedLink ? 'Copied Link' : 'Copy Test Link'}
              </button>
            </div>
            <div style={{ background: "var(--bg-glass)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sampleCheckoutLink}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


