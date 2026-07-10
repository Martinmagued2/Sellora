"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SAFE_ACCOUNT_FIELDS } from "@/lib/safe-fields";
import {
  Camera, Globe, Check, Loader2, ArrowRight, ArrowLeft,
  Store, Sparkles, MessageSquare, Send, CheckCircle2,
  Star, FileText, Package, Bot, Pencil, Heart,
  Shirt, Utensils, Dumbbell, GraduationCap, Car,
  Building2, CameraIcon, Cpu, Briefcase, HelpCircle
} from "lucide-react";
import "./onboarding.css";

const INDUSTRIES = [
  { label: "Fashion & Apparel", icon: "👗" },
  { label: "Food & Beverage", icon: "🍽️" },
  { label: "Health & Wellness", icon: "💪" },
  { label: "Education", icon: "🎓" },
  { label: "Automotive", icon: "🚗" },
  { label: "Real Estate", icon: "🏠" },
  { label: "Photography", icon: "📸" },
  { label: "Technology", icon: "💻" },
  { label: "Professional Services", icon: "💼" },
  { label: "Other", icon: "📦" },
];

const PERSONALITIES = [
  {
    id: "professional",
    name: "Professional",
    desc: "Formal, precise, and authoritative",
    iconBg: "#3b82f6",
    iconEmoji: "💼",
    bubbleBg: "#3b82f6",
    sample: "Good day. How may I assist you with your inquiry today?",
  },
  {
    id: "friendly",
    name: "Friendly",
    desc: "Warm, approachable, and helpful",
    iconBg: "#f59e0b",
    iconEmoji: "😊",
    bubbleBg: "#14b8a6",
    sample: "Hey there! 😊 I'd love to help you find what you're looking for!",
  },
  {
    id: "casual",
    name: "Casual",
    desc: "Relaxed, fun, and easygoing",
    iconBg: "#f97316",
    iconEmoji: "👋",
    bubbleBg: "#f97316",
    sample: "Hey! What's up? Let me know if you need anything! ✌️",
  },
  {
    id: "luxury",
    name: "Luxury",
    desc: "Elegant, refined, and premium",
    iconBg: "#a855f7",
    iconEmoji: "✨",
    bubbleBg: "#ec4899",
    sample: "Welcome. We're delighted to assist you with our exclusive collection.",
  },
];

const TOTAL_STEPS = 6; // 0-5

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const scrollRef = useRef(null);

  // Form states
  const [formData, setFormData] = useState({
    businessName: "",
    industry: "Fashion & Apparel",
    businessDescription: "",
  });
  const [productData, setProductData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
  });
  const [personality, setPersonality] = useState("friendly");
  const [connected, setConnected] = useState({
    instagram: false,
    facebook: false,
  });
  const [connecting, setConnecting] = useState({
    instagram: false,
    facebook: false,
  });

  // Chat simulator state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const fetchAccount = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);

      const { data: accountData } = await supabase
        .from("accounts")
        .select(SAFE_ACCOUNT_FIELDS)
        .eq("id", userData.user.id)
        .single();

      if (accountData) {
        if (accountData.onboarding_completed) {
          router.push("/dashboard");
          return;
        }
        setAccount(accountData);
        setFormData({
          businessName: accountData.business_name || "",
          industry: accountData.industry || "Fashion & Apparel",
          businessDescription: accountData.business_description || "",
        });
        setPersonality(accountData.ai_personality || "friendly");
        setConnected({
          instagram: !!accountData.instagram_page_id,
          facebook: !!accountData.facebook_page_id,
        });
      }
      setLoading(false);
    };
    fetchAccount();
  }, [router, supabase]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Step 1: Save Business Info
  const handleSaveBusinessInfo = async () => {
    setSaving(true);
    const updates = {
      business_name: formData.businessName,
      industry: formData.industry,
      business_description: formData.businessDescription,
      ai_personality: personality,
    };

    if (account) {
      await supabase.from("accounts").update(updates).eq("id", account.id);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("accounts").upsert({
        id: userId,
        email: userData?.user?.email,
        ...updates,
        plan: "starter",
        plan_status: "trialing",
      });
      const { data: newAcct } = await supabase
        .from("accounts")
        .select(SAFE_ACCOUNT_FIELDS)
        .eq("id", userId)
        .single();
      if (newAcct) setAccount(newAcct);
    }
    setSaving(false);
    setStep(2);
  };

  // Step 2: Save Product
  const handleSaveProduct = async () => {
    if (productData.name) {
      setSaving(true);
      await supabase.from("products").insert({
        account_id: account?.id || userId,
        name: productData.name,
        description: productData.description || null,
        price: parseFloat(productData.price) || 0,
        category: productData.category || null,
        status: "active",
      });
      setSaving(false);
    }
    setStep(3);
  };

  // Step 3: Save Personality
  const handleSavePersonality = async () => {
    setSaving(true);
    await supabase
      .from("accounts")
      .update({ ai_personality: personality })
      .eq("id", account?.id || userId);
    setSaving(false);
    setStep(4);
  };

  const handleConnect = async (platform) => {
    if (connected[platform]) return;
    setConnecting({ ...connecting, [platform]: true });

    if (process.env.NEXT_PUBLIC_META_APP_ID) {
      window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/meta-callback')}&scope=pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_messages,business_management&response_type=code&auth_type=rerequest&state=${platform}_${account?.id || userId}`;
      return;
    }

    await new Promise((r) => setTimeout(r, 1200));
    setConnected({ ...connected, [platform]: true });
    setConnecting({ ...connecting, [platform]: false });
  };

  const handleFinish = async () => {
    setSaving(true);
    await supabase
      .from("accounts")
      .update({ onboarding_completed: true })
      .eq("id", account?.id || userId);
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="ob-loading">
        <Loader2 className="ob-spin" size={32} />
      </div>
    );
  }

  const renderProgress = () => {
    const dots = [];
    for (let i = 0; i < TOTAL_STEPS; i++) {
      if (i > 0) {
        dots.push(
          <div
            key={`line-${i}`}
            className={`ob-progress-line ${step >= i ? "completed" : ""}`}
          />
        );
      }
      dots.push(
        <div
          key={`dot-${i}`}
          className={`ob-progress-dot ${
            step > i ? "completed" : step === i ? "current" : ""
          }`}
        />
      );
    }
    return <div className="ob-progress">{dots}</div>;
  };

  return (
    <div className="ob-layout">
      <div className="ob-container">
        {renderProgress()}

        <div className="ob-card">
          {/* ═══ Step 0: Welcome ═══ */}
          {step === 0 && (
            <div className="ob-step">
              <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <div className="ob-pulse" />
                <div className="ob-icon-circle ob-icon-circle-lg">
                  <Star size={32} />
                </div>
              </div>

              <h1 className="ob-heading" style={{ textAlign: "center" }}>
                Welcome to Sellora!
              </h1>
              <p
                className="ob-subtitle"
                style={{ textAlign: "center", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}
              >
                Your AI-powered auto-response platform. We&apos;ll help you set up smart, instant replies
                for your customers across Facebook and Instagram — in just a few minutes.
              </p>

              <div className="ob-badges" style={{ justifyContent: "center" }}>
                <div className="ob-badge">
                  <Bot size={14} className="ob-badge-icon" /> AI Chat
                </div>
                <div className="ob-badge">
                  <Globe size={14} className="ob-badge-icon" /> Social Connect
                </div>
                <div className="ob-badge">
                  <Send size={14} className="ob-badge-icon" /> Instant Replies
                </div>
                <div className="ob-badge">
                  <Heart size={14} className="ob-badge-icon" /> Custom Personality
                </div>
              </div>

              <div className="ob-footer" style={{ justifyContent: "flex-end" }}>
                <button className="ob-btn ob-btn-primary" onClick={() => setStep(1)}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 1: Business Info ═══ */}
          {step === 1 && (
            <div className="ob-step">
              <div className="ob-icon-circle">
                <FileText size={24} />
              </div>

              <h1 className="ob-heading">Tell Us About Your Business</h1>
              <p className="ob-subtitle">
                This helps our AI understand your brand and serve your customers better.
              </p>

              <div className="ob-field-group">
                <label className="ob-field-label">
                  Business Name <span className="ob-field-required">*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <Store size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="text"
                    className="ob-field"
                    style={{ paddingLeft: 42 }}
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="E.g. Urban Style"
                  />
                </div>
              </div>

              <div className="ob-field-group">
                <label className="ob-field-label">
                  Industry <span className="ob-field-required">*</span>
                </label>
                <div className="ob-industry-grid">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind.label}
                      className={`ob-industry-btn ${formData.industry === ind.label ? "selected" : ""}`}
                      onClick={() => setFormData({ ...formData, industry: ind.label })}
                    >
                      <span className="ob-industry-icon">{ind.icon}</span>
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ob-field-group">
                <label className="ob-field-label">
                  Business Description
                </label>
                <textarea
                  className="ob-field"
                  value={formData.businessDescription}
                  onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                  placeholder="E.g. We're a boutique fashion store specializing in sustainable clothing..."
                  rows={3}
                />
              </div>

              <div className="ob-footer">
                <button className="ob-btn ob-btn-secondary" onClick={() => setStep(0)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  className="ob-btn ob-btn-primary"
                  onClick={handleSaveBusinessInfo}
                  disabled={!formData.businessName || saving}
                >
                  {saving ? <Loader2 className="ob-spin" size={16} /> : <>Continue <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 2: Add First Product ═══ */}
          {step === 2 && (
            <div className="ob-step">
              <div className="ob-icon-circle">
                <Package size={24} />
              </div>

              <h1 className="ob-heading">Add Your First Product</h1>
              <p className="ob-subtitle">
                Your AI needs products to talk about. Let&apos;s add one to get started!
              </p>

              <div className="ob-field-group">
                <label className="ob-field-label">
                  Product Name <span className="ob-field-required">*</span>
                </label>
                <input
                  type="text"
                  className="ob-field"
                  value={productData.name}
                  onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                  placeholder="E.g. Premium Silk Scarf"
                />
              </div>

              <div className="ob-field-group">
                <label className="ob-field-label">
                  Description <span className="ob-field-required">*</span>
                </label>
                <textarea
                  className="ob-field"
                  value={productData.description}
                  onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                  placeholder="Describe your product features, materials, benefits..."
                  rows={3}
                />
              </div>

              <div className="ob-field-row">
                <div className="ob-field-group">
                  <label className="ob-field-label">Price</label>
                  <input
                    type="number"
                    className="ob-field"
                    value={productData.price}
                    onChange={(e) => setProductData({ ...productData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="ob-field-group">
                  <label className="ob-field-label">Category</label>
                  <input
                    type="text"
                    className="ob-field"
                    value={productData.category}
                    onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                    placeholder="E.g. Clothing"
                  />
                </div>
              </div>

              <div className="ob-footer">
                <button className="ob-btn ob-btn-secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <div className="ob-footer-right">
                  <button className="ob-btn ob-btn-skip" onClick={() => setStep(3)}>
                    Skip
                  </button>
                  <button
                    className="ob-btn ob-btn-primary"
                    onClick={handleSaveProduct}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="ob-spin" size={16} /> : <>Continue <ArrowRight size={16} /></>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 3: Choose AI Personality ═══ */}
          {step === 3 && (
            <div className="ob-step">
              <div className="ob-icon-circle">
                <MessageSquare size={24} />
              </div>

              <h1 className="ob-heading">Choose Your AI Personality</h1>
              <p className="ob-subtitle">
                How should your AI assistant sound when talking to customers?
              </p>

              <div className="ob-personality-grid">
                {PERSONALITIES.map((p) => (
                  <div
                    key={p.id}
                    className={`ob-personality-card ${personality === p.id ? "selected" : ""}`}
                    onClick={() => setPersonality(p.id)}
                  >
                    {personality === p.id && <div className="ob-personality-selected-dot" />}
                    <div
                      className="ob-personality-icon"
                      style={{ background: p.iconBg }}
                    >
                      {p.iconEmoji}
                    </div>
                    <div className="ob-personality-name">{p.name}</div>
                    <div className="ob-personality-desc">{p.desc}</div>
                    <div
                      className="ob-personality-bubble"
                      style={{ background: p.bubbleBg }}
                    >
                      {p.sample}
                    </div>
                  </div>
                ))}

                {/* Custom personality card */}
                <div
                  className={`ob-personality-card ob-personality-custom ${personality === "custom" ? "selected" : ""}`}
                  onClick={() => setPersonality("custom")}
                >
                  {personality === "custom" && <div className="ob-personality-selected-dot" />}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      className="ob-personality-icon"
                      style={{ background: "#475569" }}
                    >
                      ✏️
                    </div>
                    <div>
                      <div className="ob-personality-name">Write Custom</div>
                      <div className="ob-personality-desc">
                        Define your own unique AI personality and tone
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ob-footer">
                <button className="ob-btn ob-btn-secondary" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  className="ob-btn ob-btn-primary"
                  onClick={handleSavePersonality}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="ob-spin" size={16} /> : <>Continue <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 4: Connect Channels ═══ */}
          {step === 4 && (
            <div className="ob-step">
              <div className="ob-icon-circle">
                <Globe size={24} />
              </div>

              <h1 className="ob-heading">Connect Your Channels</h1>
              <p className="ob-subtitle">
                Connect your social accounts so the AI can start responding to customers.
              </p>

              <div className="ob-channel-grid">
                <div
                  className={`ob-channel-card ${connected.instagram ? "connected" : ""}`}
                  onClick={() => handleConnect("instagram")}
                >
                  <div className="ob-channel-icon ig">
                    <Camera size={24} />
                  </div>
                  <div className="ob-channel-name">Instagram</div>
                  <div className={`ob-channel-status ${connected.instagram ? "connected" : ""}`}>
                    {connecting.instagram ? (
                      <Loader2 className="ob-spin" size={14} />
                    ) : connected.instagram ? (
                      "✓ Connected"
                    ) : (
                      "Connect DMs"
                    )}
                  </div>
                </div>

                <div
                  className={`ob-channel-card ${connected.facebook ? "connected" : ""}`}
                  onClick={() => handleConnect("facebook")}
                >
                  <div className="ob-channel-icon fb">
                    <Globe size={24} />
                  </div>
                  <div className="ob-channel-name">Facebook</div>
                  <div className={`ob-channel-status ${connected.facebook ? "connected" : ""}`}>
                    {connecting.facebook ? (
                      <Loader2 className="ob-spin" size={14} />
                    ) : connected.facebook ? (
                      "✓ Connected"
                    ) : (
                      "Connect Messenger"
                    )}
                  </div>
                </div>
              </div>

              <p style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
                💡 You can skip this and connect real accounts later in settings.
              </p>

              <div className="ob-footer">
                <button className="ob-btn ob-btn-secondary" onClick={() => setStep(3)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <div className="ob-footer-right">
                  {!connected.instagram && !connected.facebook && (
                    <button className="ob-btn ob-btn-skip" onClick={() => setStep(5)}>
                      Skip
                    </button>
                  )}
                  <button
                    className="ob-btn ob-btn-primary"
                    onClick={() => setStep(5)}
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 5: Success ═══ */}
          {step === 5 && (
            <div className="ob-step" style={{ textAlign: "center" }}>
              <div className="ob-success-icon">
                <CheckCircle2 size={40} color="white" />
              </div>

              <h1 className="ob-heading" style={{ textAlign: "center" }}>
                You&apos;re All Set!
              </h1>
              <p
                className="ob-subtitle"
                style={{ textAlign: "center", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}
              >
                Your AI assistant is ready to handle real customers on Instagram and Facebook.
              </p>

              <div className="ob-check-list" style={{ textAlign: "left" }}>
                <div className="ob-check-item">
                  <Check size={16} className="ob-check-icon" /> AI Assistant Configured
                </div>
                <div className="ob-check-item">
                  <Check size={16} className="ob-check-icon" /> Product Catalog Initialized
                </div>
                <div className="ob-check-item">
                  <Check size={16} className="ob-check-icon" /> Secure Messaging Sandbox Enabled
                </div>
              </div>

              <div className="ob-footer" style={{ justifyContent: "center" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    className="ob-btn ob-btn-secondary"
                    onClick={() => router.push("/dashboard/settings?tab=channels")}
                  >
                    Connect Real Channels
                  </button>
                  <button
                    className="ob-btn ob-btn-primary"
                    onClick={handleFinish}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="ob-spin" size={16} />
                    ) : (
                      <>Go to Dashboard <ArrowRight size={16} /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
