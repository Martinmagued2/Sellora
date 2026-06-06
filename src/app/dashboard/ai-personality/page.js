"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Bot, MessageCircle, Settings2, Eye, Save, RotateCcw,
  ToggleLeft, ToggleRight, Loader2, Check, Plus, X, Send,
  Camera, Globe, Smartphone, AlertTriangle, Shield,
  Zap, MessageSquare, Volume2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEFAULTS = {
  aiName: "Sellora AI",
  aiAvatar: "🤖",
  aiPersonalityType: "friendly",
  aiCustomDescription: "",
  aiFormality: 5,
  aiEnthusiasm: 7,
  aiVerbosity: 5,
  aiEmpathy: 7,
  aiMaxResponseLength: 500,
  aiAutoSuggestProducts: true,
  aiAutoCollectEmail: false,
  aiAutoCollectPhone: false,
  aiEscalationKeywords: ["human", "agent", "manager", "complaint"],
  aiForbiddenTopics: [],
  autoGreeting: false,
  autoGreetingMessage: "",
  greetingPerChannel: false,
  instagramGreeting: "",
  facebookGreeting: "",
  whatsappGreeting: "",
  greetingDelaySeconds: 0,
};

const PERSONALITY_TYPES = [
  { value: "professional", label: "Professional", icon: "💼", desc: "Business-like, polished, and authoritative" },
  { value: "friendly", label: "Friendly", icon: "😊", desc: "Warm, approachable, and helpful" },
  { value: "casual", label: "Casual", icon: "🤙", desc: "Relaxed, informal, and easygoing" },
  { value: "luxury", label: "Luxury", icon: "✨", desc: "Premium, sophisticated, and refined" },
  { value: "playful", label: "Playful", icon: "🎉", desc: "Fun, energetic, and creative" },
];

const SAMPLE_MESSAGES = [
  "Hi, I'm looking for a product recommendation for dry skin!",
  "What's your return policy?",
  "Do you have this in size medium?",
  "I had a problem with my last order, can you help?",
  "What are your best sellers?",
];

export default function AIPersonalityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Persona Config
  const [aiName, setAiName] = useState(DEFAULTS.aiName);
  const [aiAvatar, setAiAvatar] = useState(DEFAULTS.aiAvatar);
  const [personalityType, setPersonalityType] = useState(DEFAULTS.aiPersonalityType);
  const [customDescription, setCustomDescription] = useState(DEFAULTS.aiCustomDescription);
  const [formality, setFormality] = useState(DEFAULTS.aiFormality);
  const [enthusiasm, setEnthusiasm] = useState(DEFAULTS.aiEnthusiasm);
  const [verbosity, setVerbosity] = useState(DEFAULTS.aiVerbosity);
  const [empathy, setEmpathy] = useState(DEFAULTS.aiEmpathy);

  // Channel Greetings
  const [autoGreeting, setAutoGreeting] = useState(DEFAULTS.autoGreeting);
  const [autoGreetingMessage, setAutoGreetingMessage] = useState(DEFAULTS.autoGreetingMessage);
  const [greetingPerChannel, setGreetingPerChannel] = useState(DEFAULTS.greetingPerChannel);
  const [instagramGreeting, setInstagramGreeting] = useState(DEFAULTS.instagramGreeting);
  const [facebookGreeting, setFacebookGreeting] = useState(DEFAULTS.facebookGreeting);
  const [whatsappGreeting, setWhatsappGreeting] = useState(DEFAULTS.whatsappGreeting);
  const [greetingDelay, setGreetingDelay] = useState(DEFAULTS.greetingDelaySeconds);
  const [sameGreetingAll, setSameGreetingAll] = useState(false);

  // Behavior Rules
  const [maxResponseLength, setMaxResponseLength] = useState(DEFAULTS.aiMaxResponseLength);
  const [autoSuggestProducts, setAutoSuggestProducts] = useState(DEFAULTS.aiAutoSuggestProducts);
  const [autoCollectEmail, setAutoCollectEmail] = useState(DEFAULTS.aiAutoCollectEmail);
  const [autoCollectPhone, setAutoCollectPhone] = useState(DEFAULTS.aiAutoCollectPhone);
  const [escalationKeywords, setEscalationKeywords] = useState(DEFAULTS.aiEscalationKeywords);
  const [forbiddenTopics, setForbiddenTopics] = useState(DEFAULTS.aiForbiddenTopics);
  const [newKeyword, setNewKeyword] = useState("");
  const [newTopic, setNewTopic] = useState("");

  // Preview
  const [previewMessage, setPreviewMessage] = useState(SAMPLE_MESSAGES[0]);
  const [previewResponse, setPreviewResponse] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProvider, setPreviewProvider] = useState("");
  const [businessName, setBusinessName] = useState("My Store");
  const [country, setCountry] = useState("Egypt");

  const getSupabase = () => createClient();

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const res = await fetch("/api/ai-personality");
        const data = await res.json();
        if (data.settings) {
          const s = data.settings;
          setAiName(s.ai_name || DEFAULTS.aiName);
          setAiAvatar(s.ai_avatar || DEFAULTS.aiAvatar);
          setPersonalityType(s.ai_personality_type || DEFAULTS.aiPersonalityType);
          setCustomDescription(s.ai_custom_description || DEFAULTS.aiCustomDescription);
          setFormality(s.ai_formality ?? DEFAULTS.aiFormality);
          setEnthusiasm(s.ai_enthusiasm ?? DEFAULTS.aiEnthusiasm);
          setVerbosity(s.ai_verbosity ?? DEFAULTS.aiVerbosity);
          setEmpathy(s.ai_empathy ?? DEFAULTS.aiEmpathy);
          setMaxResponseLength(s.ai_max_response_length ?? DEFAULTS.aiMaxResponseLength);
          setAutoSuggestProducts(s.ai_auto_suggest_products ?? DEFAULTS.aiAutoSuggestProducts);
          setAutoCollectEmail(s.ai_auto_collect_email ?? DEFAULTS.aiAutoCollectEmail);
          setAutoCollectPhone(s.ai_auto_collect_phone ?? DEFAULTS.aiAutoCollectPhone);
          setEscalationKeywords(s.ai_escalation_keywords || DEFAULTS.aiEscalationKeywords);
          setForbiddenTopics(s.ai_forbidden_topics || DEFAULTS.aiForbiddenTopics);
          setAutoGreeting(s.auto_greeting || false);
          setAutoGreetingMessage(s.auto_greeting_message || "");
          setGreetingPerChannel(s.greeting_per_channel || false);
          setInstagramGreeting(s.instagram_greeting || "");
          setFacebookGreeting(s.facebook_greeting || "");
          setWhatsappGreeting(s.whatsapp_greeting || "");
          setGreetingDelay(s.greeting_delay_seconds || 0);
          setBusinessName(s.business_name || "My Store");
          setCountry(s.country || "Egypt");
          setSameGreetingAll(!!s.instagram_greeting && s.instagram_greeting === s.facebook_greeting && s.facebook_greeting === s.whatsapp_greeting);
        }
      } catch (err) {
        console.error("AI Personality page load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-personality", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_name: aiName,
          ai_avatar: aiAvatar,
          ai_personality_type: personalityType,
          ai_custom_description: customDescription,
          ai_formality: formality,
          ai_enthusiasm: enthusiasm,
          ai_verbosity: verbosity,
          ai_empathy: empathy,
          ai_max_response_length: maxResponseLength,
          ai_auto_suggest_products: autoSuggestProducts,
          ai_auto_collect_email: autoCollectEmail,
          ai_auto_collect_phone: autoCollectPhone,
          ai_escalation_keywords: escalationKeywords,
          ai_forbidden_topics: forbiddenTopics,
          auto_greeting: autoGreeting,
          auto_greeting_message: autoGreetingMessage,
          greeting_per_channel: greetingPerChannel,
          instagram_greeting: instagramGreeting,
          facebook_greeting: facebookGreeting,
          whatsapp_greeting: whatsappGreeting,
          greeting_delay_seconds: greetingDelay,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Save error:", err);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setAiName(DEFAULTS.aiName);
    setAiAvatar(DEFAULTS.aiAvatar);
    setPersonalityType(DEFAULTS.aiPersonalityType);
    setCustomDescription(DEFAULTS.aiCustomDescription);
    setFormality(DEFAULTS.aiFormality);
    setEnthusiasm(DEFAULTS.aiEnthusiasm);
    setVerbosity(DEFAULTS.aiVerbosity);
    setEmpathy(DEFAULTS.aiEmpathy);
    setMaxResponseLength(DEFAULTS.aiMaxResponseLength);
    setAutoSuggestProducts(DEFAULTS.aiAutoSuggestProducts);
    setAutoCollectEmail(DEFAULTS.aiAutoCollectEmail);
    setAutoCollectPhone(DEFAULTS.aiAutoCollectPhone);
    setEscalationKeywords(DEFAULTS.aiEscalationKeywords);
    setForbiddenTopics(DEFAULTS.aiForbiddenTopics);
    setAutoGreeting(DEFAULTS.autoGreeting);
    setAutoGreetingMessage(DEFAULTS.autoGreetingMessage);
    setGreetingPerChannel(DEFAULTS.greetingPerChannel);
    setInstagramGreeting(DEFAULTS.instagramGreeting);
    setFacebookGreeting(DEFAULTS.facebookGreeting);
    setWhatsappGreeting(DEFAULTS.whatsappGreeting);
    setGreetingDelay(DEFAULTS.greetingDelaySeconds);
    setSameGreetingAll(false);
  };

  const handleGeneratePreview = async () => {
    setPreviewLoading(true);
    setPreviewResponse("");
    try {
      const res = await fetch("/api/ai-personality/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiName,
          personalityType,
          customDescription,
          formality,
          enthusiasm,
          verbosity,
          empathy,
          maxResponseLength,
          forbiddenTopics,
          escalationKeywords,
          customerMessage: previewMessage,
          businessName,
          country,
        }),
      });
      const data = await res.json();
      if (data.preview) {
        setPreviewResponse(data.preview);
        setPreviewProvider(data.provider || "");
      } else {
        setPreviewResponse("Error: " + (data.error || "Failed to generate preview"));
      }
    } catch (err) {
      setPreviewResponse("Error: " + err.message);
    }
    setPreviewLoading(false);
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !escalationKeywords.includes(newKeyword.trim().toLowerCase())) {
      setEscalationKeywords([...escalationKeywords, newKeyword.trim().toLowerCase()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw) => {
    setEscalationKeywords(escalationKeywords.filter((k) => k !== kw));
  };

  const addTopic = () => {
    if (newTopic.trim() && !forbiddenTopics.includes(newTopic.trim().toLowerCase())) {
      setForbiddenTopics([...forbiddenTopics, newTopic.trim().toLowerCase()]);
      setNewTopic("");
    }
  };

  const removeTopic = (topic) => {
    setForbiddenTopics(forbiddenTopics.filter((t) => t !== topic));
  };

  const handleSameGreetingToggle = () => {
    const newVal = !sameGreetingAll;
    setSameGreetingAll(newVal);
    if (newVal && autoGreetingMessage) {
      setInstagramGreeting(autoGreetingMessage);
      setFacebookGreeting(autoGreetingMessage);
      setWhatsappGreeting(autoGreetingMessage);
    }
  };

  // Slider render function
  const renderSlider = ({ label, value, onChange, min = 1, max = 10, leftLabel, rightLabel, color = "var(--accent-primary)" }) => (
    <div className="ai-slider-group">
      <div className="ai-slider-header">
        <span className="ai-slider-label">{label}</span>
        <span className="ai-slider-value" style={{ color }}>{value}</span>
      </div>
      <div className="ai-slider-track">
        <span className="ai-slider-endpoint">{leftLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ai-slider-input"
          style={{ accentColor: color }}
        />
        <span className="ai-slider-endpoint">{rightLabel}</span>
      </div>
    </div>
  );

  // Toggle render function
  const renderToggle = ({ enabled, onToggle, label, description }) => (
    <div className="ai-toggle-row">
      <div className="ai-toggle-info">
        <div className="ai-toggle-label">{label}</div>
        {description && <div className="ai-toggle-desc">{description}</div>}
      </div>
      <div
        className="ai-toggle-switch"
        onClick={onToggle}
        style={{ color: enabled ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
      >
        {enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
      </div>
    </div>
  );

  // Tag list render function
  const renderTagList = ({ items, onRemove, placeholder, color = "var(--accent-primary)" }) => (
    <div className="ai-tag-list">
      {items.map((item, i) => (
        <span key={i} className="ai-tag" style={{ borderColor: color, color }}>
          {item}
          <button className="ai-tag-remove" onClick={() => onRemove(item)}>
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={28} style={{ color: "var(--accent-primary-light)" }} />
          AI Personality Builder
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} /> Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? <><Check size={16} /> Saved!</> : saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Configuration</>}
          </button>
        </div>
      </div>

      {/* Main Layout: Two columns */}
      <div className="ai-personality-layout">
        {/* Left Column: Configuration */}
        <div className="ai-config-column">

          {/* Section 1: AI Persona Configuration */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
            <div className="dashboard-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bot size={18} style={{ color: "var(--accent-primary-light)" }} />
                AI Persona Configuration
              </h3>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {/* AI Name & Avatar Row */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Avatar</label>
                  <div className="ai-avatar-input-wrapper">
                    <span className="ai-avatar-preview">{aiAvatar}</span>
                    <input
                      type="text"
                      className="form-input ai-avatar-input"
                      value={aiAvatar}
                      onChange={(e) => setAiAvatar(e.target.value)}
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">AI Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="e.g., Sara, Alex, Sellora AI"
                  />
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                    This is what the bot calls itself in conversations
                  </p>
                </div>
              </div>

              {/* Personality Type Dropdown */}
              <div className="form-group">
                <label className="form-label">Personality Type</label>
                <div className="ai-personality-selector">
                  {PERSONALITY_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      className={`ai-personality-option ${personalityType === pt.value ? "active" : ""}`}
                      onClick={() => setPersonalityType(pt.value)}
                    >
                      <span className="ai-personality-option-icon">{pt.icon}</span>
                      <span className="ai-personality-option-label">{pt.label}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 6 }}>
                  {PERSONALITY_TYPES.find((p) => p.value === personalityType)?.desc}
                </p>
              </div>

              {/* Custom Personality Description */}
              <div className="form-group">
                <label className="form-label">
                  Custom Personality Description
                  <span style={{ fontSize: 10, color: "var(--accent-orange)", fontWeight: 500, marginLeft: 8 }}>OVERRIDES TYPE</span>
                </label>
                <textarea
                  className="form-input form-textarea"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe how your AI should behave. This overrides the personality type dropdown above."
                />
              </div>

              {/* Tone Sliders */}
              <div className="ai-sliders-section">
                <h4 className="ai-section-subtitle">
                  <Volume2 size={16} /> Tone Controls
                </h4>
                {renderSlider({
                  label: "Formality",
                  value: formality,
                  onChange: setFormality,
                  leftLabel: "Very Casual",
                  rightLabel: "Very Formal",
                  color: "var(--accent-primary-light)",
                })}
                {renderSlider({
                  label: "Enthusiasm",
                  value: enthusiasm,
                  onChange: setEnthusiasm,
                  leftLabel: "Low",
                  rightLabel: "High",
                  color: "var(--accent-orange)",
                })}
                {renderSlider({
                  label: "Verbosity",
                  value: verbosity,
                  onChange: setVerbosity,
                  leftLabel: "Concise",
                  rightLabel: "Detailed",
                  color: "var(--accent-secondary)",
                })}
                {renderSlider({
                  label: "Empathy",
                  value: empathy,
                  onChange: setEmpathy,
                  leftLabel: "Low",
                  rightLabel: "High",
                  color: "var(--accent-green)",
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Channel-Specific Greetings */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
            <div className="dashboard-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={18} style={{ color: "var(--accent-green)" }} />
                Channel-Specific Greetings
              </h3>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {/* Auto-Greeting Toggle */}
              {renderToggle({
                enabled: autoGreeting,
                onToggle: () => setAutoGreeting(!autoGreeting),
                label: "Auto-Greeting",
                description: "Automatically send a welcome message to new customers",
              })}

              {autoGreeting && (
                <>
                  {/* Default Greeting */}
                  <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
                    <label className="form-label">Default Greeting Message</label>
                    <div style={{ position: "relative" }}>
                      <textarea
                        className="form-input form-textarea"
                        value={autoGreetingMessage}
                        onChange={(e) => setAutoGreetingMessage(e.target.value)}
                        rows={3}
                        placeholder="Hi! Welcome to {business_name} 👋 How can I help you today?"
                      />
                      <span className="ai-char-count">{autoGreetingMessage.length}/500</span>
                    </div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
                      Use {"{business_name}"} for your store name, {"{name}"} for the customer&apos;s name
                    </p>
                  </div>

                  {/* Greeting Delay */}
                  <div className="form-group">
                    <label className="form-label">Greeting Delay</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={greetingDelay}
                        onChange={(e) => setGreetingDelay(Number(e.target.value))}
                        style={{ flex: 1, accentColor: "var(--accent-primary)" }}
                      />
                      <span className="ai-slider-value" style={{ minWidth: 40, textAlign: "center" }}>
                        {greetingDelay}s
                      </span>
                    </div>
                  </div>

                  {/* Same greeting for all toggle */}
                  <div className="ai-toggle-row" style={{ marginTop: "var(--space-md)", marginBottom: "var(--space-md)" }}>
                    <div className="ai-toggle-info">
                      <div className="ai-toggle-label" style={{ fontSize: "var(--font-size-sm)" }}>Use same greeting for all channels</div>
                    </div>
                    <div
                      onClick={handleSameGreetingToggle}
                      style={{ color: sameGreetingAll ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }}
                    >
                      {sameGreetingAll ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </div>
                  </div>

                  {/* Per-Channel Greetings */}
                  {!sameGreetingAll && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-md)", marginTop: "var(--space-md)" }}>
                      <div className="ai-channel-greeting-card">
                        <div className="ai-channel-greeting-header">
                          <Camera size={16} style={{ color: "#E1306C" }} />
                          <span>Instagram</span>
                        </div>
                        <textarea
                          className="form-input form-textarea"
                          value={instagramGreeting}
                          onChange={(e) => setInstagramGreeting(e.target.value)}
                          rows={3}
                          placeholder="Hey {name}! 👋 Welcome to {business_name} on Instagram!"
                          style={{ fontSize: 12 }}
                        />
                        <span className="ai-char-count">{instagramGreeting.length}/500</span>
                      </div>
                      <div className="ai-channel-greeting-card">
                        <div className="ai-channel-greeting-header">
                          <Globe size={16} style={{ color: "#1877F2" }} />
                          <span>Facebook</span>
                        </div>
                        <textarea
                          className="form-input form-textarea"
                          value={facebookGreeting}
                          onChange={(e) => setFacebookGreeting(e.target.value)}
                          rows={3}
                          placeholder="Hi {name}! Welcome to {business_name}! How can we help?"
                          style={{ fontSize: 12 }}
                        />
                        <span className="ai-char-count">{facebookGreeting.length}/500</span>
                      </div>
                      <div className="ai-channel-greeting-card">
                        <div className="ai-channel-greeting-header">
                          <Smartphone size={16} style={{ color: "#25D366" }} />
                          <span>WhatsApp</span>
                        </div>
                        <textarea
                          className="form-input form-textarea"
                          value={whatsappGreeting}
                          onChange={(e) => setWhatsappGreeting(e.target.value)}
                          rows={3}
                          placeholder="Hello {name}! 🙏 Thanks for messaging {business_name} on WhatsApp!"
                          style={{ fontSize: 12 }}
                        />
                        <span className="ai-char-count">{whatsappGreeting.length}/500</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Section 3: AI Behavior Rules */}
          <div className="dashboard-panel" style={{ marginBottom: "var(--space-xl)" }}>
            <div className="dashboard-panel-header">
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings2 size={18} style={{ color: "var(--accent-orange)" }} />
                AI Behavior Rules
              </h3>
            </div>
            <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
              {/* Max Response Length */}
              <div className="form-group">
                <label className="form-label">Max Response Length (characters)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={maxResponseLength}
                    onChange={(e) => setMaxResponseLength(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent-orange)" }}
                  />
                  <span className="ai-slider-value" style={{ color: "var(--accent-orange)", minWidth: 60, textAlign: "center" }}>
                    {maxResponseLength}
                  </span>
                </div>
              </div>

              {/* Toggles */}
              {renderToggle({
                enabled: autoSuggestProducts,
                onToggle: () => setAutoSuggestProducts(!autoSuggestProducts),
                label: "Auto-Suggest Products",
                description: "AI will proactively recommend relevant products during conversations",
              })}
              {renderToggle({
                enabled: autoCollectEmail,
                onToggle: () => setAutoCollectEmail(!autoCollectEmail),
                label: "Auto-Collect Email",
                description: "AI will ask for customer email when appropriate",
              })}
              {renderToggle({
                enabled: autoCollectPhone,
                onToggle: () => setAutoCollectPhone(!autoCollectPhone),
                label: "Auto-Collect Phone",
                description: "AI will ask for customer phone number when appropriate",
              })}

              {/* Escalation Keywords */}
              <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Shield size={14} style={{ color: "var(--accent-red)" }} />
                  Escalation Keywords
                </label>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>
                  Keywords that trigger human agent escalation
                </p>
                {renderTagList({ items: escalationKeywords, onRemove: removeKeyword, color: "var(--accent-red)" })}
                <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                    placeholder="Add keyword..."
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={addKeyword}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Forbidden Topics */}
              <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={14} style={{ color: "var(--accent-orange)" }} />
                  Forbidden Topics
                </label>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)" }}>
                  Topics the AI should NEVER discuss
                </p>
                {renderTagList({ items: forbiddenTopics, onRemove: removeTopic, color: "var(--accent-orange)" })}
                <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTopic()}
                    placeholder="Add forbidden topic..."
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={addTopic}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div className="ai-preview-column">
          <div className="ai-preview-sticky">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Eye size={18} style={{ color: "var(--accent-secondary)" }} />
                  Live Preview
                </h3>
                {previewProvider && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 6, background: "rgba(0, 210, 255, 0.1)",
                    color: "var(--accent-secondary)", textTransform: "uppercase",
                  }}>
                    {previewProvider}
                  </span>
                )}
              </div>
              <div className="dashboard-panel-body" style={{ padding: 0 }}>
                {/* Preview Chat Window */}
                <div className="ai-preview-chat">
                  {/* AI Identity Bar */}
                  <div className="ai-preview-identity">
                    <span className="ai-preview-avatar">{aiAvatar}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{aiName}</div>
                      <div style={{ fontSize: 10, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }}></span>
                        Online
                      </div>
                    </div>
                    <div className="ai-preview-personality-badge">
                      {PERSONALITY_TYPES.find((p) => p.value === personalityType)?.icon} {personalityType}
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="ai-preview-messages">
                    {/* Customer Message */}
                    <div className="ai-preview-msg customer">
                      <div className="ai-preview-msg-avatar cust">👤</div>
                      <div className="ai-preview-msg-bubble cust">
                        {previewMessage}
                        <span className="ai-preview-msg-time">Just now</span>
                      </div>
                    </div>

                    {/* AI Response */}
                    {previewLoading ? (
                      <div className="ai-preview-msg ai">
                        <div className="ai-preview-msg-avatar ai-av">{aiAvatar}</div>
                        <div className="ai-preview-msg-bubble ai">
                          <div className="ai-preview-typing">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      </div>
                    ) : previewResponse ? (
                      <div className="ai-preview-msg ai" style={{ animation: "fade-in-up 0.3s ease" }}>
                        <div className="ai-preview-msg-avatar ai-av">{aiAvatar}</div>
                        <div className="ai-preview-msg-bubble ai">
                          {previewResponse}
                          <span className="ai-preview-msg-time">
                            <Bot size={10} style={{ display: "inline", verticalAlign: "middle" }} /> AI · Just now
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="ai-preview-empty">
                        <Sparkles size={24} style={{ color: "var(--text-tertiary)", marginBottom: 8 }} />
                        <p>Click &quot;Generate Preview&quot; to see how your AI would respond</p>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="ai-preview-input-area">
                    <div style={{ marginBottom: "var(--space-sm)", display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                      {SAMPLE_MESSAGES.map((msg, i) => (
                        <button
                          key={i}
                          className={`ai-sample-msg-btn ${previewMessage === msg ? "active" : ""}`}
                          onClick={() => setPreviewMessage(msg)}
                        >
                          {msg.length > 35 ? msg.substring(0, 35) + "..." : msg}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <input
                        type="text"
                        className="form-input"
                        value={previewMessage}
                        onChange={(e) => setPreviewMessage(e.target.value)}
                        placeholder="Type a sample customer message..."
                        style={{ flex: 1, fontSize: 12 }}
                        onKeyDown={(e) => e.key === "Enter" && handleGeneratePreview()}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleGeneratePreview}
                        disabled={previewLoading || !previewMessage.trim()}
                      >
                        {previewLoading ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Settings Summary */}
                <div className="ai-preview-summary">
                  <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-tertiary)", letterSpacing: 1, marginBottom: "var(--space-sm)" }}>
                    Current Settings
                  </h4>
                  <div className="ai-summary-grid">
                    <div className="ai-summary-item">
                      <span className="ai-summary-key">Formality</span>
                      <div className="ai-summary-bar-bg">
                        <div className="ai-summary-bar" style={{ width: `${formality * 10}%`, background: "var(--accent-primary-light)" }}></div>
                      </div>
                    </div>
                    <div className="ai-summary-item">
                      <span className="ai-summary-key">Enthusiasm</span>
                      <div className="ai-summary-bar-bg">
                        <div className="ai-summary-bar" style={{ width: `${enthusiasm * 10}%`, background: "var(--accent-orange)" }}></div>
                      </div>
                    </div>
                    <div className="ai-summary-item">
                      <span className="ai-summary-key">Verbosity</span>
                      <div className="ai-summary-bar-bg">
                        <div className="ai-summary-bar" style={{ width: `${verbosity * 10}%`, background: "var(--accent-secondary)" }}></div>
                      </div>
                    </div>
                    <div className="ai-summary-item">
                      <span className="ai-summary-key">Empathy</span>
                      <div className="ai-summary-bar-bg">
                        <div className="ai-summary-bar" style={{ width: `${empathy * 10}%`, background: "var(--accent-green)" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
