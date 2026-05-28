"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Camera, Globe, Check, Loader2, ArrowRight, ArrowLeft, 
  Store, Sparkles, MessageSquare, Send, CheckCircle2 
} from "lucide-react";
import "./onboarding.css";

export default function OnboardingPage() {
  const [step, setStep] = useState(0); // 0: Welcome, 1: Info, 2: Channels, 3: Product, 4: Test AI, 5: Success
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
  });
  const [productData, setProductData] = useState({
    name: "",
    price: "",
  });
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
        .select("*")
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
        });
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

  const handleNextStep1 = async() => {
    setSaving(true);
    const updates = {
      business_name: formData.businessName,
      industry: formData.industry
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
      const { data: newAcct } = await supabase.from("accounts").select("*").eq("id", userId).single();
      if (newAcct) setAccount(newAcct);
    }
    
    setSaving(false);
    setStep(2);
  };

  const handleConnect = async(platform) => {
    if (connected[platform]) return;
    setConnecting({ ...connecting, [platform]: true });
    
    // Simulate connection
    await new Promise(r => setTimeout(r, 1200));
    
    setConnected({ ...connected, [platform]: true });
    setConnecting({ ...connecting, [platform]: false });
  };

  const handleNextStep3 = async() => {
    if (productData.name && productData.price) {
      setSaving(true);
      await supabase.from("products").insert({
        account_id: account?.id || userId,
        name: productData.name,
        price: parseFloat(productData.price),
        status: "active"
      });
      setSaving(false);
    }
    setStep(4);
    // Initialize demo chat
    setMessages([
      { id: 1, text: "Hey! Just wanted to ask a question...", type: "customer" }
    ]);
  };

  const handleSendMessage = async (textOverride) => {
    const text = textOverride || input;
    if (!text.trim()) return;

    const newMsg = { id: Date.now(), text, type: "customer" };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    // AI Logic simulator
    setTimeout(() => {
      let response = "";
      const lower = text.toLowerCase();
      const pName = productData.name || "item";

      if (lower.includes("price") || lower.includes("how much")) {
        response = `The ${pName} is ${productData.price || "999"} EGP. We have it in stock!`;
      } else if (lower.includes("available") || lower.includes("have it") || lower.includes(pName.toLowerCase())) {
        response = `Yes! We have the ${pName} available for ${productData.price || "999"} EGP. Would you like to place an order?`;
      } else {
        response = `Hello! I'm your AI assistant. I see you're interested in our ${pName}. How can I help you today?`;
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, text: response, type: "ai" }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleFinish = async() => {
    setSaving(true);
    await supabase.from("accounts").update({
      onboarding_completed: true
    }).eq("id", account?.id || userId);
    router.push("/dashboard");
  };

  if (loading) {
    return <div className="onboarding-layout"><Loader2 className="spin" /></div>;
  }

  const totalSteps = 6;
  const progressPercent = (step / (totalSteps - 1)) * 100;

  return (
    <div className="onboarding-layout">
      <div className="onboarding-container">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-logo">
             <div style={{ background: "var(--accent-gradient)", padding: 6, borderRadius: 8 }}>
               <Sparkles size={16} color="white" />
             </div>
             Sellora
          </div>
          <div className="progress-container">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          <div className="onboarding-step-count">
             {step}/{totalSteps - 1}
          </div>
        </div>

        {/* Content Body */}
        <div className="onboarding-body">
          {step === 0 && (
            <div className="onboarding-step">
              <div className="welcome-visual">
                <div className="welcome-pulse"></div>
                <div className="welcome-icon-circle">
                  <Sparkles size={48} />
                </div>
              </div>
              <h1 className="onboarding-title">Welcome to Sellora</h1>
              <p className="onboarding-subtitle">Let’s get your AI-powered sales assistant set up in 2 minutes. Experience the future of social commerce.</p>
              <button className="btn btn-primary btn-lg" style={{ width: "100%", padding: "18px" }} onClick={() => setStep(1)}>
                Start Setup <ArrowRight size={20} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step">
              <h1 className="onboarding-title">Tell us about your brand</h1>
              <p className="onboarding-subtitle">A few details to help the AI learn your style.</p>
              
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <div style={{ position: "relative" }}>
                  <Store size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: 48 }}
                    value={formData.businessName}
                    onChange={e => setFormData({...formData, businessName: e.target.value})}
                    placeholder="e.g. Urban Style"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "24px" }}>
                <label className="form-label">Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {["Fashion & Apparel", "Electronics", "Health & Beauty", "Home & Decor", "Food", "Other"].map(ind => (
                    <button 
                      key={ind}
                      onClick={() => setFormData({...formData, industry: ind})}
                      className={`industry-pill ${formData.industry === ind ? "active" : ""}`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <h1 className="onboarding-title">Connect Channels</h1>
              <p className="onboarding-subtitle">Connect your platforms to see the AI handle real messages.</p>
              
              <div className="connect-grid">
                <div className={`connect-btn ${connected.instagram ? 'active' : ''}`} onClick={() => handleConnect('instagram')}>
                  <div className="platform-icon instagram">
                    <Camera size={24} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Instagram</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{connected.instagram ? '✓ Connected' : 'Connect DMs'}</div>
                  </div>
                </div>

                <div className={`connect-btn ${connected.facebook ? 'active' : ''}`} onClick={() => handleConnect('facebook')}>
                  <div className="platform-icon facebook">
                    <Globe size={24} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Facebook</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{connected.facebook ? '✓ Connected' : 'Connect Messenger'}</div>
                  </div>
                </div>
              </div>
              
              <p style={{ marginTop: "24px", fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
                💡 Note: You can skip this and connect real accounts later in settings.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <h1 className="onboarding-title">Add a Product</h1>
              <p className="onboarding-subtitle">This helps the AI respond with product details and prices instantly.</p>
              
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={productData.name}
                  onChange={e => setProductData({...productData, name: e.target.value})}
                  placeholder="e.g. Premium Silk Scarf"
                />
              </div>
              <div className="form-group" style={{ marginTop: "16px" }}>
                <label className="form-label">Price (EGP)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={productData.price}
                  onChange={e => setProductData({...productData, price: e.target.value})}
                  placeholder="1200"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-step">
              <h1 className="onboarding-title">Test your AI assistant</h1>
              <p className="onboarding-subtitle">See how it responds using the info you provided. Try asking about the product.</p>
              
              <div className="chat-demo-container">
                <div className="chat-demo-messages" ref={scrollRef}>
                  {messages.map(msg => (
                    <div key={msg.id} className={`chat-bubble ${msg.type}`}>
                      {msg.text}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="chat-bubble ai">
                      <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="chat-quick-actions">
                  <button className="quick-action-btn" onClick={() => handleSendMessage(`Do you have the ${productData.name || 'product'}?`)}>
                    Check Availability
                  </button>
                  <button className="quick-action-btn" onClick={() => handleSendMessage("What is the price?")}>
                    Ask Price
                  </button>
                </div>

                <div className="chat-demo-input">
                  <input 
                    type="text" 
                    className="chat-demo-field" 
                    placeholder="Type a test message..." 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: "8px 12px", borderRadius: "10px" }}
                    onClick={() => handleSendMessage()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="onboarding-step">
              <div className="success-check-visual">
                 <CheckCircle2 size={80} color="var(--accent-green)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="success-badge">Setup Complete</div>
                <h1 className="onboarding-title" style={{ fontSize: "32px" }}>You’re all set!</h1>
                <p className="onboarding-subtitle">Your AI is ready to handle real customers on Instagram and Facebook.</p>
              </div>

              <div className="check-list" style={{ marginTop: "12px" }}>
                <div className="check-item"><Check size={16} className="check-icon" /> AI Assistant Configured</div>
                <div className="check-item"><Check size={16} className="check-icon" /> Product Catalog Initialized</div>
                <div className="check-item"><Check size={16} className="check-icon" /> Secure Messaging Sandbox Enabled</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="onboarding-footer">
          {step > 1 && step < 5 ? (
             <button className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={saving}>
               <ArrowLeft size={16} /> Back
             </button>
          ) : <div></div>}

          <div>
             {step === 2 && !connected.instagram && !connected.facebook && (
                <button className="btn" style={{ background: "none", color: "var(--text-tertiary)", marginRight: 16 }} onClick={() => setStep(3)}>
                  Skip for now
                </button>
             )}
             {step === 3 && !productData.name && (
                <button className="btn" style={{ background: "none", color: "var(--text-tertiary)", marginRight: 16 }} onClick={() => setStep(4)}>
                  Skip for now
                </button>
             )}

             {step === 1 && (
               <button className="btn btn-primary" onClick={handleNextStep1} disabled={!formData.businessName || saving}>
                 {saving ? <Loader2 className="spin" size={16} /> : <>Continue <ArrowRight size={16}/></>}
               </button>
             )}
             {step === 2 && (
               <button className="btn btn-primary" onClick={() => setStep(3)}>
                 Continue <ArrowRight size={16}/>
               </button>
             )}
             {step === 3 && (
               <button className="btn btn-primary" onClick={handleNextStep3} disabled={saving}>
                 {saving ? <Loader2 className="spin" size={16} /> : <>Continue <ArrowRight size={16}/></>}
               </button>
             )}
             {step === 4 && (
               <button className="btn btn-primary" onClick={() => setStep(5)} disabled={messages.length < 2}>
                 Finish Setup <ArrowRight size={16}/>
               </button>
             )}
             {step === 5 && (
               <div style={{ display: "flex", gap: "12px" }}>
                 <button className="btn btn-secondary" onClick={() => router.push("/dashboard/settings?tab=channels")}>
                   Connect Real Channels
                 </button>
                 <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
                   {saving ? <Loader2 className="spin" size={16} /> : <>Go to Dashboard <ArrowRight size={16}/></>}
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
