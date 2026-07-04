"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle, ShoppingBag, Users, BarChart3, Zap, Send, Bot, Package,
  CreditCard, TrendingUp, Check, Plus, ChevronRight, Star, ArrowRight,
  Menu, X, Clock, AlertTriangle, Copy, Megaphone, Globe, Shield, Sun,
  Moon, Calculator, Timer, DollarSign, Smile, LayoutDashboard, MessageSquare,
  ShoppingCart, BarChart2, Sparkles, Play, Headphones, Bell, Calendar,
  Target, Radio, Camera,
} from "lucide-react";
import { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import GSAPAnimations from "@/components/GSAPAnimations";
import MagneticButton from "@/components/MagneticButton";
import BounceCards from "./components/BounceCards";

/* Dynamic import for 3D hero scene (SSR safe) */
const HeroScene3D = lazy(() => import("./components/HeroScene3D"));

/* ============================================
   PARTICLE CANVAS — UPGRADED
   ============================================ */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const particles = useRef([]);
  const rafId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h;

    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(80, Math.floor(window.innerWidth / 18));
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? "88,101,242" : "0,210,255",
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const ps = particles.current;
      const mx = mouse.current.x; const my = mouse.current.y;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const dx = p.x - mx; const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) { const force = (180 - dist) / 180 * 0.8; p.vx += (dx / dist) * force; p.vy += (dy / dist) * force; }
        p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},0.6)`; ctx.fill();
        for (let j = i + 1; j < ps.length; j++) {
          const p2 = ps[j]; const d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 140) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(${p.color},${0.15 * (1 - d / 140)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      }
      rafId.current = requestAnimationFrame(draw);
    }
    draw();
    const handleMouse = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const handleLeave = () => { mouse.current = { x: -1000, y: -1000 }; };
    window.addEventListener("mousemove", handleMouse); window.addEventListener("mouseleave", handleLeave);
    return () => { cancelAnimationFrame(rafId.current); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", handleMouse); window.removeEventListener("mouseleave", handleLeave); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ============================================
   MORPH BLOB COMPONENT
   ============================================ */
function MorphBlob({ color, style = {} }) {
  return (
    <svg viewBox="0 0 600 600" style={{ position: "absolute", ...style, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color === "purple" ? "#5865F2" : "#00D2FF"} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color === "purple" ? "#00D2FF" : "#5865F2"} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path fill={`url(#grad-${color})`}>
        <animate attributeName="d" dur="12s" repeatCount="indefinite" values="
          M300,100 C450,50 550,180 520,300 C490,420 380,520 260,500 C140,480 50,380 80,250 C110,120 150,150 300,100 Z;
          M300,80 C420,60 580,200 500,320 C420,440 350,530 230,510 C110,490 30,350 100,220 C170,90 180,100 300,80 Z;
          M300,120 C480,80 530,220 490,340 C450,460 340,500 240,480 C140,460 70,360 120,240 C170,120 120,160 300,120 Z;
          M300,100 C450,50 550,180 520,300 C490,420 380,520 260,500 C140,480 50,380 80,250 C110,120 150,150 300,100 Z" />
      </path>
    </svg>
  );
}

/* ============================================
   ANIMATED COUNTER
   ============================================ */
function AnimatedCounter({ value, duration = 1.5 }) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const [displayValue, setDisplayValue] = useState(isNumeric ? 0 : value);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView || !isNumeric) return;
    let start = 0; const end = numericValue; const increment = end / (duration * 60);
    const timer = setInterval(() => { start += increment; if (start >= end) { setDisplayValue(end); clearInterval(timer); } else { setDisplayValue(Math.floor(start)); } }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, numericValue, isNumeric, duration]);

  return <span ref={ref}>{isNumeric ? Math.round(displayValue).toLocaleString() : displayValue}</span>;
}

/* ============================================
   TILT 3D CARD — mouse-tracking tilt
   ============================================ */
function TiltCard({ children, className = "", style = {} }) {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)");
  }, []);

  return (
    <div
      ref={cardRef}
      className={`tilt-card ${className}`}
      style={{ ...style, transform, transition: "transform 0.15s ease-out", transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

/* ============================================
   TYPING INDICATOR — three bouncing dots
   ============================================ */
function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span /><span /><span />
    </div>
  );
}

/* ============================================
   AI CHAT DEMO — Interactive chat simulator
   ============================================ */
function AIChatDemo() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const chatRef = useRef(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const hasStarted = useRef(false);

  const demoConversation = [
    { role: "customer", text: "Hi! Do you have cotton t-shirts?", delay: 800 },
    { role: "typing", delay: 1200 },
    { role: "ai", text: "Absolutely! \ud83c\udfa3 We have premium cotton t-shirts starting from 150 EGP. Available in White, Black, Navy, and Grey. Sizes S-XXL. Would you like to see our collection?", delay: 1500 },
    { role: "customer", text: "Yes, what colors do you have in Large?", delay: 2000 },
    { role: "typing", delay: 1200 },
    { role: "ai", text: "In size Large, we have: \u26aa White - 150 EGP, \u26ab Black - 150 EGP, \ud83d\udd35 Navy - 175 EGP, \ud83e\ude36 Grey - 150 EGP. All are 100% Egyptian cotton! Which one catches your eye? \ud83d\ude0a", delay: 1800 },
    { role: "customer", text: "I'll take 2 Navy ones", delay: 2000 },
    { role: "typing", delay: 1200 },
    { role: "ai", text: "Great choice! \ud83d\uded2 Here's your order: 2x Navy Cotton Tee (Large) - 350 EGP total. I'll send a payment link via InstaPay. Shall I proceed?", delay: 1500 },
  ];

  useEffect(() => {
    if (!isInView || hasStarted.current) return;
    hasStarted.current = true;

    let timeout;
    const playConversation = async () => {
      for (let i = 0; i < demoConversation.length; i++) {
        const msg = demoConversation[i];
        await new Promise(r => { timeout = setTimeout(r, msg.delay); });

        if (msg.role === "typing") {
          setIsTyping(true);
          await new Promise(r => { timeout = setTimeout(r, 1500); });
          setIsTyping(false);
        } else {
          setMessages(prev => [...prev, { role: msg.role, text: msg.text }]);
          setCurrentIndex(i);
        }
      }
    };
    playConversation();
    return () => clearTimeout(timeout);
  }, [isInView]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <section className="section chat-demo-section" id="ai-demo" ref={sectionRef}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-primary" style={{ marginBottom: 16 }}>
            <Bot size={12} />
            AI Conversation Demo
          </span>
          <h2 className="section-title-reveal">Watch Sellora AI <span className="text-gradient-static">in Action</span></h2>
          <p>See how our AI handles real customer conversations — instantly, accurately, and in any language.</p>
        </div>

        <motion.div
          className="chat-demo-card"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="chat-demo-header">
            <div className="chat-demo-avatar">
              <Bot size={20} />
            </div>
            <div>
              <div className="chat-demo-name">Sellora AI</div>
              <div className="chat-demo-status"><span className="status-dot" />Online</div>
            </div>
          </div>

          <div className="chat-demo-messages" ref={chatRef}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                className={`chat-demo-msg ${msg.role === "customer" ? "customer" : "ai"}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {msg.role === "ai" && <div className="chat-msg-avatar"><Bot size={14} /></div>}
                <div className="chat-msg-bubble">{msg.text}</div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                className="chat-demo-msg ai"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="chat-msg-avatar"><Bot size={14} /></div>
                <div className="chat-msg-bubble typing-bubble"><TypingIndicator /></div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================
   ROI CALCULATOR
   ============================================ */
function ROICalculator() {
  const [dms, setDms] = useState(50);
  const [orderValue, setOrderValue] = useState(300);
  const [hours, setHours] = useState(4);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const hoursSaved = Math.round(hours * 7 * 0.8);
  const extraRevenue = Math.round(dms * 0.15 * orderValue * 30);
  const responseBefore = hours > 0 ? Math.max(1, Math.round(hours * 0.5)) : 1;

  const results = [
    { icon: <Timer size={20} />, label: "Hours saved per week", value: hoursSaved, suffix: " hrs", color: "var(--accent-secondary)" },
    { icon: <DollarSign size={20} />, label: "Extra monthly revenue", value: extraRevenue, suffix: " EGP", color: "var(--accent-green)" },
    { icon: <Zap size={20} />, label: "Response time", value: `${responseBefore} hrs → 2 min`, suffix: "", color: "var(--accent-orange)" },
    { icon: <Smile size={20} />, label: "Customer satisfaction", value: "+45%", suffix: "", color: "var(--accent-primary-light)" },
  ];

  return (
    <section className="section roi-calculator-section" id="roi-calculator" ref={ref}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-primary" style={{ marginBottom: 16 }}><Calculator size={12} /> ROI Calculator</span>
          <h2 className="section-title-reveal">See Your <span className="text-gradient-static">Potential ROI</span></h2>
          <p>Estimate how much time and money Sellora can save you every month.</p>
        </div>
        <motion.div className="roi-calculator-card" initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="roi-calculator-inner">
            <div className="roi-sliders-col">
              {[
                { label: "How many DMs do you receive per day?", value: dms, min: 10, max: 500, step: 1, set: setDms, display: `${dms}` },
                { label: "Average order value (EGP)", value: orderValue, min: 50, max: 5000, step: 50, set: setOrderValue, display: `${orderValue.toLocaleString()} EGP` },
                { label: "Hours spent replying per day", value: hours, min: 1, max: 12, step: 1, set: setHours, display: `${hours} hrs` },
              ].map((s, i) => (
                <div key={i} className="roi-slider-group">
                  <div className="roi-slider-header"><label>{s.label}</label><span className="roi-slider-value">{s.display}</span></div>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.set(Number(e.target.value))} className="roi-slider" />
                  <div className="roi-slider-range"><span>{s.min}</span><span>{s.max.toLocaleString()}</span></div>
                </div>
              ))}
            </div>
            <div className="roi-results-col">
              {results.map((item, i) => (
                <motion.div key={i} className="roi-result-card" initial={{ opacity: 0, x: 30 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}>
                  <div className="roi-result-icon" style={{ background: `${item.color}20`, color: item.color }}>{item.icon}</div>
                  <div className="roi-result-text">
                    <span className="roi-result-label">{item.label}</span>
                    <span className="roi-result-value" style={{ color: item.color }}>
                      {typeof item.value === "number" ? <><AnimatedCounter value={item.value} duration={1.2} />{item.suffix}</> : item.value}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================
   LIVE DASHBOARD PREVIEW
   ============================================ */
function LiveDashboardPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const tabs = [
    { label: "Conversations", icon: <MessageSquare size={14} /> },
    { label: "Orders", icon: <ShoppingCart size={14} /> },
    { label: "Analytics", icon: <BarChart2 size={14} /> },
  ];

  const chatMessages = [
    { name: "Ahmed M.", msg: "Hi, is the blue shirt available in size L?", time: "2:34 PM", incoming: true },
    { name: "Sellora AI", msg: "Yes! The Blue Classic Shirt is available in L. Would you like to order? Price: 450 EGP", time: "2:34 PM", incoming: false },
    { name: "Ahmed M.", msg: "Yes please! I'll take 2", time: "2:35 PM", incoming: true },
  ];

  const orders = [
    { id: "#1847", customer: "Nour A.", items: "2x Blue Shirt", total: "900 EGP", status: "Delivered", statusColor: "var(--accent-green)" },
    { id: "#1848", customer: "Omar H.", items: "1x Black Bag", total: "450 EGP", status: "Shipped", statusColor: "var(--accent-secondary)" },
    { id: "#1849", customer: "Sara Y.", items: "3x Cotton Tee", total: "750 EGP", status: "Processing", statusColor: "var(--accent-orange)" },
  ];

  const analyticsData = [
    { label: "Mon", value: 65 }, { label: "Tue", value: 80 }, { label: "Wed", value: 45 },
    { label: "Thu", value: 90 }, { label: "Fri", value: 70 }, { label: "Sat", value: 95 }, { label: "Sun", value: 85 },
  ];

  return (
    <section className="section dashboard-preview-section" id="dashboard-preview" ref={ref}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-green" style={{ marginBottom: 16 }}><LayoutDashboard size={12} /> Live Preview</span>
          <h2 className="section-title-reveal">Experience the <span className="text-gradient-static">Dashboard</span></h2>
          <p>See how Sellora helps you manage conversations, orders, and analytics — all in one place.</p>
        </div>
        <motion.div className="dashboard-preview-card" initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="dashboard-browser-bar">
            <div className="dashboard-browser-dots"><span className="dot red" /><span className="dot yellow" /><span className="dot green" /></div>
            <div className="dashboard-browser-url"><Shield size={12} /><span>app.sellora.app/dashboard</span></div>
          </div>
          <div className="dashboard-preview-tabs">
            {tabs.map((tab, i) => (<button key={i} className={`dashboard-preview-tab ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}>{tab.icon}<span>{tab.label}</span></button>))}
          </div>
          <div className="dashboard-preview-content">
            <AnimatePresence mode="wait">
              {activeTab === 0 && (<motion.div key="conv" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                {chatMessages.map((msg, i) => (<div key={i} className={`dashboard-chat-msg ${msg.incoming ? "incoming" : "outgoing"}`}><div className="dashboard-chat-name">{msg.name}</div><div className="dashboard-chat-bubble">{msg.msg}</div><div className="dashboard-chat-time">{msg.time}</div></div>))}
              </motion.div>)}
              {activeTab === 1 && (<motion.div key="ord" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                <table className="dashboard-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>{orders.map((o, i) => (<tr key={i}><td style={{ fontWeight: 600 }}>{o.id}</td><td>{o.customer}</td><td>{o.items}</td><td style={{ fontWeight: 600 }}>{o.total}</td><td><span className="dashboard-order-status" style={{ background: `${o.statusColor}20`, color: o.statusColor }}>{o.status}</span></td></tr>))}</tbody>
                </table>
              </motion.div>)}
              {activeTab === 2 && (<motion.div key="anlt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                <div className="dashboard-analytics-header"><div><div className="dashboard-analytics-label">Weekly Revenue</div><div className="dashboard-analytics-total">12,450 EGP</div></div><span className="dashboard-analytics-change">+23% vs last week</span></div>
                <div className="dashboard-chart">{analyticsData.map((bar, i) => (<div key={i} className="dashboard-chart-bar-wrapper"><motion.div className="dashboard-chart-bar" initial={{ height: 0 }} animate={{ height: `${bar.value}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }} /><span className="dashboard-chart-label">{bar.label}</span></div>))}</div>
              </motion.div>)}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================
   SVG WAVE DIVIDER — animated wave between sections
   ============================================ */
function SVGWaveDivider({ flip = false, color1 = "var(--bg-primary)", color2 = "var(--bg-secondary)", style = {} }) {
  return (
    <div className={`svg-wave-divider ${flip ? "flipped" : ""}`} style={{ ...style, position: "relative", zIndex: 2 }}>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 80 }}>
        <defs>
          <linearGradient id={`wave-grad-${flip ? "f" : "n"}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--accent-secondary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <path fill={color1 === color2 ? "var(--bg-secondary)" : color2} d="M0,40 C360,100 720,0 1080,60 C1260,80 1380,50 1440,40 L1440,100 L0,100 Z" opacity="0.5">
          <animate attributeName="d" dur="8s" repeatCount="indefinite" values="
            M0,40 C360,100 720,0 1080,60 C1260,80 1380,50 1440,40 L1440,100 L0,100 Z;
            M0,60 C360,10 720,90 1080,30 C1260,50 1380,70 1440,50 L1440,100 L0,100 Z;
            M0,40 C360,100 720,0 1080,60 C1260,80 1380,50 1440,40 L1440,100 L0,100 Z" />
        </path>
        <path fill={color1 === color2 ? "var(--bg-secondary)" : color2} d="M0,60 C480,10 960,90 1440,30 L1440,100 L0,100 Z" opacity="0.7">
          <animate attributeName="d" dur="6s" repeatCount="indefinite" values="
            M0,60 C480,10 960,90 1440,30 L1440,100 L0,100 Z;
            M0,40 C480,80 960,20 1440,60 L1440,100 L0,100 Z;
            M0,60 C480,10 960,90 1440,30 L1440,100 L0,100 Z" />
        </path>
      </svg>
    </div>
  );
}

/* ============================================
   SVG FLOATING RINGS — animated geometric shapes
   ============================================ */
function SVGFloatingRings() {
  return (
    <div className="svg-floating-rings" aria-hidden="true">
      {/* Large ring — top right */}
      <svg className="svg-ring svg-ring-1" viewBox="0 0 200 200" width="180" height="180">
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--accent-primary)" strokeWidth="0.5" strokeOpacity="0.15">
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="30s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="60" fill="none" stroke="var(--accent-secondary)" strokeWidth="0.5" strokeOpacity="0.1" strokeDasharray="8 12">
          <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="25s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="40" fill="none" stroke="var(--accent-primary-light)" strokeWidth="0.3" strokeOpacity="0.08" strokeDasharray="3 8">
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="20s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Medium ring — bottom left */}
      <svg className="svg-ring svg-ring-2" viewBox="0 0 160 160" width="140" height="140">
        <circle cx="80" cy="80" r="60" fill="none" stroke="var(--accent-secondary)" strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="12 8">
          <animateTransform attributeName="transform" type="rotate" from="0 80 80" to="360 80 80" dur="35s" repeatCount="indefinite" />
        </circle>
        <circle cx="80" cy="80" r="45" fill="none" stroke="var(--accent-primary)" strokeWidth="0.3" strokeOpacity="0.08">
          <animateTransform attributeName="transform" type="rotate" from="360 80 80" to="0 80 80" dur="28s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Small ring — middle left */}
      <svg className="svg-ring svg-ring-3" viewBox="0 0 120 120" width="100" height="100">
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--accent-primary-light)" strokeWidth="0.4" strokeOpacity="0.1" strokeDasharray="5 10">
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="22s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

/* ============================================
   SVG HEX GRID — subtle decorative hexagons
   ============================================ */
function SVGHexGrid() {
  const hexSize = 30;
  const cols = 8;
  const rows = 4;
  const hexW = hexSize * 2;
  const hexH = Math.sqrt(3) * hexSize;

  const hexPoints = (cx, cy, r) => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
  };

  return (
    <svg className="svg-hex-grid" viewBox="0 0 500 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const cx = col * hexW * 0.75 + 30;
          const cy = row * hexH + (col % 2 === 1 ? hexH / 2 : 0) + 30;
          const opacity = 0.03 + Math.random() * 0.04;
          return (
            <polygon
              key={`${row}-${col}`}
              points={hexPoints(cx, cy, hexSize - 2)}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="0.5"
              strokeOpacity={opacity}
            />
          );
        })
      )}
    </svg>
  );
}

/* ============================================
   SVG DATA FLOW — animated flowing dots along paths
   ============================================ */
function SVGDataFlow() {
  return (
    <svg className="svg-data-flow" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="flow-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="flow-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-secondary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--accent-secondary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Path 1 — top curve */}
      <path id="flow-path-1" d="M-20,80 C100,20 200,140 320,80 C440,20 520,100 620,60" fill="none" stroke="url(#flow-grad-1)" strokeWidth="1" />
      <circle r="3" fill="var(--accent-primary)" opacity="0.8">
        <animateMotion dur="6s" repeatCount="indefinite">
          <mpath href="#flow-path-1" />
        </animateMotion>
      </circle>
      <circle r="2" fill="var(--accent-secondary)" opacity="0.6">
        <animateMotion dur="6s" repeatCount="indefinite" begin="2s">
          <mpath href="#flow-path-1" />
        </animateMotion>
      </circle>

      {/* Path 2 — middle curve */}
      <path id="flow-path-2" d="M-20,200 C80,260 180,160 300,220 C420,280 500,180 620,240" fill="none" stroke="url(#flow-grad-2)" strokeWidth="1" />
      <circle r="2.5" fill="var(--accent-secondary)" opacity="0.7">
        <animateMotion dur="7s" repeatCount="indefinite">
          <mpath href="#flow-path-2" />
        </animateMotion>
      </circle>
      <circle r="2" fill="var(--accent-primary)" opacity="0.5">
        <animateMotion dur="7s" repeatCount="indefinite" begin="3s">
          <mpath href="#flow-path-2" />
        </animateMotion>
      </circle>

      {/* Path 3 — bottom curve */}
      <path id="flow-path-3" d="M-20,320 C120,280 240,360 380,300 C480,260 560,340 620,310" fill="none" stroke="url(#flow-grad-1)" strokeWidth="0.8" strokeOpacity="0.5" />
      <circle r="2" fill="var(--accent-primary)" opacity="0.6">
        <animateMotion dur="8s" repeatCount="indefinite">
          <mpath href="#flow-path-3" />
        </animateMotion>
      </circle>
    </svg>
  );
}

/* ============================================
   SVG GRAIN OVERLAY — subtle noise texture
   ============================================ */
function SVGGrainOverlay() {
  return (
    <svg className="svg-grain-overlay" aria-hidden="true">
      <filter id="grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)" opacity="0.03" />
    </svg>
  );
}

/* ============================================
   SVG DOT PATTERN — decorative dot grid
   ============================================ */
function SVGDotPattern() {
  return (
    <svg className="svg-dot-pattern" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.8" fill="var(--accent-primary)" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#dot-grid)" />
    </svg>
  );
}

/* ============================================
   BRAND MARQUEE
   ============================================ */
function BrandMarquee() {
  const brands = ["Opio", "Town Team", "Ravin", "Cottonil", "Zara Home", "H&M Egypt", "Noon", "Amazon Egypt"];
  const brandColors = ["rgba(88,101,242,0.12)", "rgba(0,210,255,0.12)", "rgba(88,101,242,0.12)", "rgba(0,210,255,0.12)", "rgba(88,101,242,0.12)", "rgba(0,210,255,0.12)", "rgba(88,101,242,0.12)", "rgba(0,210,255,0.12)"];
  const brandTextColors = ["var(--accent-primary-light)", "var(--accent-secondary)", "var(--accent-primary-light)", "var(--accent-secondary)", "var(--accent-primary-light)", "var(--accent-secondary)", "var(--accent-primary-light)", "var(--accent-secondary)"];
  const countries = ["EGYPT", "SAUDI", "UAE", "INDIA", "BRAZIL", "NIGERIA"];
  const doubledBrands = [...brands, ...brands];
  const doubledCountries = [...countries, ...countries];

  return (
    <section className="social-proof trusted-by-section">
      <p className="trusted-by-title">Trusted by leading brands</p>
      <div className="brand-marquee-row"><div className="brand-marquee-track brand-marquee-track-left">{doubledBrands.map((brand, i) => (<span key={i} className="brand-badge" style={{ background: brandColors[i % brandColors.length], color: brandTextColors[i % brandTextColors.length] }}>{brand}</span>))}</div></div>
      <p className="trusted-by-title" style={{ marginTop: "var(--space-xl)" }}>Sellers across the Middle East & beyond</p>
      <div className="brand-marquee-row"><div className="brand-marquee-track brand-marquee-track-right">{doubledCountries.map((country, i) => (<span key={i} className="social-proof-logo" style={{ margin: "0 var(--space-xl)" }}>{country}</span>))}</div></div>
    </section>
  );
}

/* ============================================
   SOLUTION SECTION — Sellora AI steps in
   ============================================ */
function SolutionSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const solutionMessages = [
    { role: "customer", text: "Hi, how much is the black bag?", time: "11:47 PM" },
    { role: "ai", text: "Hey! \ud83d\udc4b The Black Leather Bag is 450 EGP. We have it in Small, Medium, and Large. Would you like to order one?", time: "11:47 PM — instant!" },
    { role: "customer", text: "Yes! Medium please", time: "11:48 PM" },
    { role: "ai", text: "Great choice! \ud83d\uded2 Here's your order: 1x Black Leather Bag (Medium) - 450 EGP. I'll send a payment link now!", time: "11:48 PM" },
  ];

  return (
    <section className="section solution-section" id="solution" ref={ref}>
      <div className="section-inner">
        <div className="solution-grid">
          <motion.div className="solution-content solution-left" initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <span className="badge badge-green" style={{ marginBottom: 16 }}><Zap size={12} /> The Solution</span>
            <h2 className="section-title-reveal">Sellora AI <span className="text-gradient-static">never sleeps</span></h2>
            <p>While your competitors keep customers waiting, Sellora responds instantly. Every message answered. Every lead captured. Every sale closed — even at 3 AM.</p>
            <div className="solution-features">
              {[
                { icon: <Zap size={18} />, label: "Instant replies", desc: "Under 2 seconds response time" },
                { icon: <Bot size={18} />, label: "Smart conversations", desc: "AI that understands context & intent" },
                { icon: <Check size={18} />, label: "Lead conversion", desc: "Turns inquiries into confirmed orders" },
                { icon: <CreditCard size={18} />, label: "Auto payments", desc: "Sends payment links automatically" },
              ].map((item, i) => (
                <motion.div key={i} className="solution-feature" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}>
                  <div className="solution-feature-icon">{item.icon}</div>
                  <div><strong>{item.label}</strong><span>{item.desc}</span></div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div className="solution-visual solution-right" initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="solution-chat-card">
              <div className="solution-chat-header">
                <div className="solution-chat-header-ai"><Bot size={16} /><span>Sellora AI</span></div>
                <span className="solution-chat-badge"><span className="status-dot" />Active</span>
              </div>
              <div className="solution-chat-messages">
                {solutionMessages.map((msg, i) => (
                  <motion.div key={i} className={`solution-chat-msg ${msg.role}`} initial={{ opacity: 0, y: 15 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.5 + i * 0.6 }}>
                    {msg.role === "ai" && <div className="solution-ai-badge"><Bot size={10} /></div>}
                    <div className="solution-chat-bubble">{msg.text}</div>
                    <span className="solution-chat-time">{msg.time}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ============================================
   INTEGRATIONS SECTION — Animated AI Hub
   ============================================ */
function IntegrationsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const platforms = [
    { name: "WhatsApp", icon: <MessageSquare size={28} />, color: "#25D366" },
    { name: "Instagram", icon: <Camera size={28} />, color: "#E1306C" },
    { name: "Facebook", icon: <Users size={28} />, color: "#1877F2" },
    { name: "Shopify", icon: <ShoppingBag size={28} />, color: "#96BF48" },
    { name: "Websites", icon: <Globe size={28} />, color: "#00D2FF" },
  ];

  return (
    <section className="section integrations-section" id="integrations" ref={ref}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-primary" style={{ marginBottom: 16 }}><Radio size={12} /> Integrations</span>
          <h2 className="section-title-reveal">One AI, <span className="text-gradient-static">Every Channel</span></h2>
          <p>Sellora connects to all your sales channels. One dashboard, one AI, zero missed messages.</p>
        </div>

        <motion.div className="integrations-hub" initial={{ opacity: 0, scale: 0.9 }} animate={isInView ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.7 }}>
          {/* Central AI hub */}
          <div className="hub-center">
            <div className="hub-pulse" />
            <div className="hub-pulse hub-pulse-2" />
            <div className="hub-core">
              <Bot size={32} />
              <span>AI</span>
            </div>
          </div>

          {/* Platform nodes */}
          {platforms.map((platform, i) => {
            const angle = (i / platforms.length) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const radius = 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <motion.div
                key={i}
                className="hub-node"
                style={{ transform: `translate(${x}px, ${y}px)` }}
                initial={{ opacity: 0, scale: 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.5 + i * 0.15, duration: 0.5, type: "spring" }}
              >
                {/* Connection line to center */}
                <svg className="hub-connection" style={{ position: "absolute", top: "50%", left: "50%", width: Math.abs(x) + 40, height: Math.abs(y) + 40, transform: `translate(-50%, -50%)`, pointerEvents: "none" }}>
                  <line x1="50%" y1="50%" x2={x > 0 ? "100%" : "0%"} y2={y > 0 ? "100%" : "0%"} stroke={platform.color} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 4">
                    <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1.5s" repeatCount="indefinite" />
                  </line>
                </svg>
                <div className="hub-node-icon" style={{ background: `${platform.color}20`, color: platform.color, borderColor: `${platform.color}40` }}>
                  {platform.icon}
                </div>
                <span className="hub-node-label">{platform.name}</span>
              </motion.div>
            );
          })}

          {/* And more yet to come */}
          <motion.div
            className="hub-more-badge"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1.4, duration: 0.6 }}
          >
            <span className="dot-divider"><span /><span /><span /></span>
            and more yet to come
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================
   MAIN HOME COMPONENT
   ============================================ */
export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [cursorGlow, setCursorGlow] = useState({ x: 0, y: 0, visible: false });
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => { const h = () => setIsScrolled(window.scrollY > 50); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }); }, { threshold: 0.1 });
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const h = (e) => setCursorGlow({ x: e.clientX, y: e.clientY, visible: true });
    const l = () => setCursorGlow((p) => ({ ...p, visible: false }));
    window.addEventListener("mousemove", h); window.addEventListener("mouseleave", l);
    return () => { window.removeEventListener("mousemove", h); window.removeEventListener("mouseleave", l); };
  }, []);

  const features = [
    { icon: <Bot size={24} />, color: "purple", title: "AI Auto-Replies", desc: "Instant, intelligent responses across WhatsApp, Instagram & Facebook DMs in Arabic & English. Never miss a sale — even at 3 AM." },
    { icon: <Package size={24} />, color: "blue", title: "Product Catalog", desc: "Beautiful product listings shared seamlessly across all channels. Customers browse, ask questions, and order — all in one chat." },
    { icon: <ShoppingBag size={24} />, color: "green", title: "Order Management", desc: "Track every order from placement to delivery. Status updates sent automatically to customers across all platforms." },
    { icon: <CreditCard size={24} />, color: "orange", title: "Payment Links", desc: "Auto-send payment links via Fawry, InstaPay, Vodafone Cash, Stripe, or PayPal. Get paid instantly." },
    { icon: <Users size={24} />, color: "pink", title: "Customer CRM", desc: "Unified inbox for all channels. Track repeat buyers, purchase history, and preferences across all platforms." },
    { icon: <Megaphone size={24} />, color: "red", title: "Broadcast Campaigns", desc: "Send targeted promotions to customer segments across all platforms. New product? Flash sale? Reach thousands in one click." },
  ];

  const aiCapabilities = [
    { icon: <Zap size={28} />, title: "Instant Replies", desc: "AI responds in under 2 seconds, 24/7, in any language your customers speak." },
    { icon: <Target size={28} />, title: "Lead Qualification", desc: "Automatically identifies hot leads and prioritizes them for conversion." },
    { icon: <Headphones size={28} />, title: "Customer Support", desc: "Handles FAQs, complaints, and returns autonomously with empathy and accuracy." },
    { icon: <Sparkles size={28} />, title: "Product Recommendations", desc: "Suggests products based on customer preferences and browsing history." },
    { icon: <Calendar size={28} />, title: "Appointment Booking", desc: "Schedules calls, demos, and pickups directly in the chat conversation." },
    { icon: <TrendingUp size={28} />, title: "Sales Automation", desc: "From inquiry to payment — the entire sales funnel runs on autopilot." },
    { icon: <BarChart3 size={28} />, title: "Analytics", desc: "Track response times, conversion rates, revenue, and AI performance." },
  ];

  const pricingPlans = [
    { tier: "STARTER", name: "Starter", desc: "Perfect for solo sellers just getting started", price: isAnnual ? 799 : 999, features: ["1 connected channel (WA, IG or FB)", "25 products", "50 AI replies/day (Fast AI)", "100 conversations/mo", "30-day message history", "Basic analytics", "Email support"], cta: "Start Free Trial", featured: false },
    { tier: "MOST POPULAR", name: "Professional", desc: "For growing businesses that need AI power", price: isAnnual ? 1999 : 2499, features: ["2 connected channels", "Unlimited products", "500 AI replies/day (Smart AI)", "1,000 conversations/mo", "6-month message history", "Full analytics dashboard", "Webhook integrations", "3 team members", "5 broadcast campaigns/mo", "Priority support"], cta: "Start Free Trial", featured: true },
    { tier: "BUSINESS", name: "Business", desc: "For teams managing multiple brands at scale", price: isAnnual ? 4799 : 5999, features: ["All 3 channels", "Unlimited everything", "Unlimited AI (Premium GPT-4o)", "Unlimited conversations", "Unlimited message history", "Full analytics + CSV export", "Webhook integrations", "Unlimited team members", "Unlimited campaigns", "Dedicated support"], cta: "Contact Sales", featured: false },
  ];

  const testimonials = [
    { text: "Sellora saved me 4 hours every day. I used to reply to 200+ messages manually — now AI handles 80% of them perfectly.", name: "Nour Ahmed", role: "Opio Franchise Owner, Cairo", initials: "NA" },
    { text: "My orders went up 3x in the first month. Customers love browsing my catalog right inside WhatsApp. It's like having a store in their pocket.", name: "Omar Hassan", role: "Town Team Branch Manager, Alexandria", initials: "OH" },
    { text: "As an agency, we manage multiple local clothing brands like Ravin and Cottonil. Sellora lets us handle all of them from one dashboard. The ROI is insane.", name: "Sara Youssef", role: "Digital Marketing Agency, Mansoura", initials: "SY" },
  ];

  const faqs = [
    { q: "Do I need a WhatsApp Business API account?", a: "We help you set everything up! When you sign up, we guide you through connecting your WhatsApp Business number. The process takes about 10 minutes. You'll need a Meta Business account (free) and a dedicated phone number." },
    { q: "Does it work with regular WhatsApp or Instagram?", a: "Sellora works with the WhatsApp Business API, Instagram Business, and Facebook Messenger. We support all three platforms from a single unified dashboard." },
    { q: "Can the AI reply in Arabic?", a: "Absolutely! Our AI is fluent in both Arabic and English, and can switch between languages automatically. It also understands Egyptian dialect, Gulf Arabic, and formal Arabic." },
    { q: "What payment methods are supported?", a: "We support Fawry, InstaPay, Vodafone Cash, Orange Cash for Egypt. For international customers: Stripe, PayPal, and bank transfers." },
    { q: "Can I try it for free?", a: "Yes! Every plan comes with a 14-day free trial — no credit card required." },
    { q: "Is my data secure?", a: "100%. We use bank-level encryption (AES-256), all data is stored in secure cloud infrastructure, and we never share your customer data with third parties." },
  ];

  const preventNav = (e) => e.preventDefault();

  return (
    <SmoothScrollProvider>
      <GSAPAnimations />
      <ParticleCanvas />
      <SVGGrainOverlay />
      <div className="cursor-glow" style={{ left: cursorGlow.x - 200, top: cursorGlow.y - 200, opacity: cursorGlow.visible ? 1 : 0 }} />

      {/* ===== NAVBAR ===== */}
      <nav className={`navbar ${isScrolled ? "scrolled" : ""}`} id="navbar">
        <div className="navbar-inner">
          <a href="#" className="navbar-logo">
            <img src="/logo.png" alt="Sellora" className="navbar-logo-img" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>Sell<span className="text-gradient-static">ora</span></span>
          </a>
          <div className="navbar-links">
            <a href="#features">{t("nav_features")}</a>
            <a href="#solution">{t("nav_how")}</a>
            <a href="#pricing">{t("nav_pricing")}</a>
            <a href="#faq">{t("nav_faq")}</a>
          </div>
          <div className="navbar-actions">
            <button className="navbar-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="lang-switcher" style={{ position: "relative" }}>
              <button className="navbar-icon-btn" onClick={() => setLangMenuOpen(!langMenuOpen)} aria-label="Change language">
                <Globe size={18} /><span style={{ fontSize: "var(--font-size-xs)", marginLeft: 4 }}>{lang.toUpperCase()}</span>
              </button>
              {langMenuOpen && (
                <div className="lang-dropdown">
                  <button className={`lang-option ${lang === "en" ? "active" : ""}`} onClick={() => { setLang("en"); setLangMenuOpen(false); }}>English</button>
                  <button className={`lang-option ${lang === "ar" ? "active" : ""}`} onClick={() => { setLang("ar"); setLangMenuOpen(false); }}>العربية</button>
                  <button className={`lang-option ${lang === "fr" ? "active" : ""}`} onClick={() => { setLang("fr"); setLangMenuOpen(false); }}>Français</button>
                </div>
              )}
            </div>
            <button className="navbar-login" onClick={() => router.push('/login')}>{t("nav_login")}</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')}>{t("nav_get_started")} <ArrowRight size={14} /></button>
          </div>
          <button className="navbar-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* ===== MOBILE MENU ===== */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <a href="#features" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_features")}</a>
            <a href="#solution" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_how")}</a>
            <a href="#pricing" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_pricing")}</a>
            <a href="#faq" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_faq")}</a>
            <div className="mobile-menu-actions">
              <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/login"); }}>{t("nav_login")}</button>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/signup"); }}>{t("nav_get_started")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HERO — IMMERSIVE 3D ===== */}
      <section className="hero" id="hero">
        <MorphBlob color="purple" style={{ top: "-10%", right: "-5%", width: "60vw", maxWidth: 600, opacity: 0.8 }} />
        <MorphBlob color="violet" style={{ top: "20%", left: "-8%", width: "40vw", maxWidth: 400, opacity: 0.6 }} />
        <MorphBlob color="cyan" style={{ bottom: "-5%", left: "30%", width: "50vw", maxWidth: 500, opacity: 0.5 }} />
        <div className="bg-glow hero-glow-1" />
        <div className="bg-glow hero-glow-2" />
        <div className="bg-grid" />

        {/* SVG Data Flow Lines */}
        <SVGDataFlow />

        {/* 3D Hero Scene */}
        <Suspense fallback={null}>
          <HeroScene3D />
        </Suspense>

        {/* Floating notification elements */}
        <div className="hero-float-elements">
          <motion.div className="hero-float-el" animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <div className="hero-float-icon green"><Check size={16} /></div><span>Order #1847 confirmed</span>
          </motion.div>
          <motion.div className="hero-float-el" animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
            <div className="hero-float-icon blue"><Bot size={16} /></div><span>AI replied in 0.3s</span>
          </motion.div>
          <motion.div className="hero-float-el" animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
            <div className="hero-float-icon purple"><TrendingUp size={16} /></div><span>Sales up 340%</span>
          </motion.div>
          <motion.div className="hero-float-el" animate={{ y: [0, 6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}>
            <div className="hero-float-icon orange"><CreditCard size={16} /></div><span>Payment received</span>
          </motion.div>
        </div>

        <div className="hero-layout hero-layout-centered">
          <motion.div className="hero-content" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: "easeOut" }}>
            <div className="hero-badge">
              <span className="badge badge-primary"><Zap size={12} />{t("hero_badge")}</span>
            </div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}>
              <span className="hero-word">Never</span>{" "}
              <span className="hero-word">Lose</span>{" "}
              <span className="hero-word">a</span>{" "}
              <span className="hero-word">Customer</span>{" "}
              <span className="hero-word">Because</span>{" "}
              <span className="hero-word">You</span>{" "}
              <span className="hero-word text-gradient">Replied</span>{" "}
              <span className="hero-word text-gradient">Too</span>{" "}
              <span className="hero-word text-gradient">Late.</span>
            </motion.h1>

            <motion.p className="hero-subtitle hero-subtitle-mask" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}>
              {t("hero_subtitle")}
            </motion.p>

            <motion.div className="hero-cta" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}>
              <MagneticButton className="hero-cta-btn">
                <button className="btn btn-primary btn-lg magnetic-btn" onClick={() => router.push('/signup')}>
                  Join the Waitlist <ArrowRight size={18} />
                </button>
              </MagneticButton>
              <MagneticButton className="hero-cta-btn">
                <button className="btn btn-secondary btn-lg" onClick={() => router.push('/login')}>
                  Watch Demo <Play size={18} />
                </button>
              </MagneticButton>
            </motion.div>

            <motion.div className="hero-stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1 }}>
              <div className="hero-stat"><div className="hero-stat-value text-gradient-static"><span className="stat-counter" data-target="5000">0</span>+</div><div className="hero-stat-label">{t("hero_stat_sellers")}</div></div>
              <div className="hero-stat"><div className="hero-stat-value text-gradient-static"><span className="stat-counter" data-target="2500000">0</span>M+</div><div className="hero-stat-label">{t("hero_stat_messages")}</div></div>
              <div className="hero-stat"><div className="hero-stat-value text-gradient-static">3x</div><div className="hero-stat-label">Avg Sales Increase</div></div>
              <div className="hero-stat"><div className="hero-stat-value text-gradient-static"><span className="stat-counter" data-target="98">0</span>%</div><div className="hero-stat-label">{t("hero_stat_uptime")}</div></div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== BRAND MARQUEE ===== */}
      <BrandMarquee />
      <SVGWaveDivider />

      {/* ===== THE PROBLEM ===== */}
      <section className="section problem" id="problem" style={{ position: "relative", overflow: "hidden" }}>
        <SVGHexGrid />
        <div className="section-inner">
          <div className="problem-grid">
            <motion.div className="problem-content problem-left" initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <span className="badge badge-primary" style={{ marginBottom: 16 }}><AlertTriangle size={12} /> The Problem</span>
              <h2 className="section-title-reveal">You&apos;re losing sales in your <span className="text-gradient-static">DMs</span> right now</h2>
              <p>Every unanswered message is a lost customer. Every delayed reply is money left on the table. Here&apos;s what&apos;s happening:</p>
              <div className="problem-list">
                {[
                  { icon: <Clock size={18} />, title: "Missed messages at night", desc: "60% of customers message between 10PM-2AM. You're asleep, they buy from someone else." },
                  { icon: <Copy size={18} />, title: "Copy-pasting prices all day", desc: "You spend 3+ hours/day answering \"How much is this?\" and \"Is it available?\" manually." },
                  { icon: <AlertTriangle size={18} />, title: "Lost orders in chat history", desc: "No tracking. No system. Orders get mixed up, customers get frustrated, you lose repeat business." },
                ].map((item, i) => (
                  <motion.div key={i} className="problem-item" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                    <div className="problem-item-icon">{item.icon}</div>
                    <div className="problem-item-text"><h4>{item.title}</h4><p>{item.desc}</p></div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div className="problem-visual problem-right" initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <div className="problem-mockup">
                <div className="problem-chat">
                  <motion.div className="problem-chat-msg incoming" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>Hi, how much is the black bag? <span className="time">11:47 PM</span></motion.div>
                  <motion.div className="problem-chat-msg incoming" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}>Hello?<span className="time">11:52 PM</span></motion.div>
                  <motion.div className="problem-chat-msg incoming" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.8 }}>Is anyone there?<span className="time">12:15 AM</span></motion.div>
                  <motion.div className="problem-chat-missed" initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.1 }}>
                    <span className="missed-sticker">Missed</span>
                    <span className="missed-duration">8+ hrs unanswered</span>
                  </motion.div>
                  <motion.div className="problem-chat-msg outgoing" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 1.4 }}>Hi! Sorry I was asleep. The black bag is 450 EGP. Are you interested?<span className="time">8:30 AM</span></motion.div>
                  <motion.div className="problem-chat-msg incoming problem-msg-lost" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 1.7 }}>I already bought from someone else<span className="time">9:15 AM</span></motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== THE SOLUTION ===== */}
      <SolutionSection />
      <SVGWaveDivider flip />

      {/* ===== 5 CHANNELS SHOWCASE — BOUNCE CARDS ===== */}
      <section className="section" style={{ background: "var(--bg-primary)", overflow: "hidden" }}>
        <div className="section-inner" style={{ textAlign: "center" }}>
          <div className="section-header animate-on-scroll" style={{ marginBottom: 40 }}>
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><MessageSquare size={12} /> Unified Inbox</span>
            <h2 className="section-title-reveal">5 Channels. <span className="text-gradient-static">One Inbox.</span></h2>
            <p>Your customers are everywhere. Sellora's AI replies on all 5 — instantly, 24/7.</p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300, padding: "20px 0" }}>
            <BounceCards
              images={[
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%2325D366'/><stop offset='1' stop-color='%23128C7E'/></linearGradient></defs><rect width='200' height='200' fill='url(%23g)' rx='20'/><text x='100' y='110' font-size='60' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>WA</text></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23E1306C'/><stop offset='0.5' stop-color='%23F77737'/><stop offset='1' stop-color='%23FCAF45'/></linearGradient></defs><rect width='200' height='200' fill='url(%23g)' rx='20'/><text x='100' y='110' font-size='60' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>IG</text></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%231877F2'/><stop offset='1' stop-color='%23042A6F'/></linearGradient></defs><rect width='200' height='200' fill='url(%23g)' rx='20'/><text x='100' y='110' font-size='50' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>FB</text></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%230088cc'/><stop offset='1' stop-color='%23005580'/></linearGradient></defs><rect width='200' height='200' fill='url(%23g)' rx='20'/><text x='100' y='110' font-size='45' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>TG</text></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%236C5CE7'/><stop offset='1' stop-color='%23a855f7'/></linearGradient></defs><rect width='200' height='200' fill='url(%23g)' rx='20'/><text x='100' y='110' font-size='45' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>@</text></svg>",
              ]}
              containerWidth={500}
              containerHeight={280}
              animationDelay={0.3}
              animationStagger={0.1}
              easeType="elastic.out(1, 0.5)"
              transformStyles={[
                "rotate(8deg) translate(-150px)",
                "rotate(-3deg) translate(-75px)",
                "rotate(2deg)",
                "rotate(-5deg) translate(75px)",
                "rotate(6deg) translate(150px)",
              ]}
              enableHover={true}
            />
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
            {[
              { name: "WhatsApp", color: "#25D366" },
              { name: "Instagram", color: "#E1306C" },
              { name: "Facebook", color: "#1877F2" },
              { name: "Telegram", color: "#0088cc" },
              { name: "Email", color: "#6C5CE7" },
            ].map((ch) => (
              <span key={ch.name} style={{
                padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: `${ch.color}15`, color: ch.color, border: `1px solid ${ch.color}33`,
              }}>
                {ch.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI CAPABILITIES — 3D TILT CARDS ===== */}
      <section className="section" id="features" style={{ position: "relative", overflow: "hidden" }}>
        <SVGFloatingRings />
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-green" style={{ marginBottom: 16 }}><Sparkles size={12} /> AI Capabilities</span>
            <h2 className="section-title-reveal">Powered by <span className="text-gradient-static">Intelligence</span></h2>
            <p>Seven AI-powered capabilities that transform how you sell, support, and grow.</p>
          </div>

          <div className="ai-caps-grid">
            {aiCapabilities.map((cap, i) => (
              <TiltCard key={i} className="glass-card ai-cap-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="ai-cap-icon">{cap.icon}</div>
                  <h3>{cap.title}</h3>
                  <p>{cap.desc}</p>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES (ORIGINAL 6) ===== */}
      <section className="section" style={{ background: "var(--bg-secondary)" }}>
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><Zap size={12} />{t("features_badge")}</span>
            <h2 className="section-title-reveal">{t("features_title_1")} <span className="text-gradient-static">{t("features_title_2")}</span></h2>
            <p>{t("features_subtitle")}</p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <motion.div key={i} className="glass-card feature-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className={`feature-icon ${f.color}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LIVE DASHBOARD PREVIEW ===== */}
      <LiveDashboardPreview />
      <SVGWaveDivider />

      {/* ===== INTEGRATIONS ===== */}
      <IntegrationsSection />

      {/* ===== AI CHAT DEMO ===== */}
      <AIChatDemo />

      {/* ===== HOW IT WORKS ===== */}
      <section className="section how-it-works" id="how-it-works">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><Globe size={12} />{t("how_badge")}</span>
            <h2 className="section-title-reveal">{t("how_title_1")} <span className="text-gradient-static">{t("how_title_2")}</span> {t("how_title_3")}</h2>
          </div>
          <div className="steps-container">
            {[
              { num: "1", title: "Connect WhatsApp", desc: "Link your WhatsApp Business number in 2 clicks. We handle all the technical setup." },
              { num: "2", title: "Add Your Products", desc: "Upload your catalog or import from Instagram. Set prices, add photos, manage variants." },
              { num: "3", title: "Start Selling 24/7", desc: "AI handles inquiries, shows products, takes orders, and sends payment links." },
            ].map((step, i) => (
              <motion.div key={i} className="step-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2 }}>
                <div className="step-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ROI CALCULATOR ===== */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <SVGDotPattern />
        <ROICalculator />
        <SVGWaveDivider flip />
      </section>

      {/* ===== PRICING ===== */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><CreditCard size={12} />{t("pricing_badge")}</span>
            <h2 className="section-title-reveal">{t("pricing_title_1")} <span className="text-gradient-static">{t("pricing_title_2")}</span></h2>
            <p>{t("pricing_subtitle")}</p>
          </div>
          <div className="pricing-toggle animate-on-scroll">
            <span className={!isAnnual ? "active" : ""}>{t("pricing_monthly")}</span>
            <div className={`pricing-switch ${isAnnual ? "annual" : ""}`} onClick={() => setIsAnnual(!isAnnual)} id="pricing-toggle" />
            <span className={isAnnual ? "active" : ""}>{t("pricing_annual")}</span>
            {isAnnual && <span className="pricing-save">Save 20%</span>}
          </div>
          <div className="pricing-grid">
            {pricingPlans.map((plan, i) => (
              <motion.div key={i} className={`glass-card pricing-card ${plan.featured ? "featured" : ""}`}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                {plan.featured && (
                  <div className="pricing-popular"><span className="badge badge-primary">Most Popular</span></div>
                )}
                {plan.featured && <div className="rotating-border" />}
                <div className="pricing-tier">{plan.tier}</div>
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-desc">{plan.desc}</div>
                <div className="pricing-price">
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-currency" style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, alignSelf: "baseline", marginBottom: 2 }}>{lang === "en" ? " EGP" : " جنيه"}</span>
                  <span className="pricing-period">/month</span>
                </div>
                <div className="pricing-features">
                  {plan.features.map((f, j) => (<div key={j} className="pricing-feature"><div className="pricing-feature-check"><Check size={12} /></div>{f}</div>))}
                </div>
                <button className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"} btn-lg`} id={`pricing-cta-${i}`} onClick={() => router.push('/signup')}>{plan.cta}</button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="section" id="comparison" style={{ paddingTop: 0 }}>
        <div className="section-inner">
          <div className="animate-on-scroll" style={{ overflowX: "auto" }}>
            <h3 style={{ textAlign: "center", marginBottom: "var(--space-xl)", fontSize: "var(--font-size-xl)", fontWeight: 700 }}>Full Feature <span className="text-gradient-static">Comparison</span></h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
              <thead><tr><th style={{ textAlign: "left", padding: "var(--space-md) var(--space-lg)", color: "var(--text-tertiary)", fontWeight: 600, borderBottom: "1px solid var(--border-subtle)" }}>Feature</th>
                {[{ name: "Starter", color: "var(--accent-green)" }, { name: "Professional", color: "var(--accent-primary-light)" }, { name: "Business", color: "var(--accent-orange)" }].map((p) => (
                  <th key={p.name} style={{ textAlign: "center", padding: "var(--space-md) var(--space-lg)", fontWeight: 700, color: p.color, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{p.name}</th>
                ))}
              </tr></thead>
              <tbody>
                {[
                  { category: "AI & Automation" }, { label: "AI Model", starter: "Fast (Llama 3)", pro: "Smart (GPT-4o Mini)", biz: "Premium (GPT-4o)" },
                  { label: "AI Replies / Day", starter: "50", pro: "500", biz: "Unlimited" },
                  { label: "AI Simulator Tests / Day", starter: "10", pro: "50", biz: "Unlimited" },
                  { label: "Custom AI Personality", starter: false, pro: true, biz: true },
                  { category: "Scale & Limits" }, { label: "Connected Channels", starter: "1", pro: "2", biz: "3 (All)" },
                  { label: "Products", starter: "25", pro: "Unlimited", biz: "Unlimited" },
                  { label: "Conversations / Month", starter: "100", pro: "1,000", biz: "Unlimited" },
                  { category: "Data & History" }, { label: "Message History", starter: "30 days", pro: "6 months", biz: "Unlimited" },
                  { label: "Analytics", starter: "Basic", pro: "Full", biz: "Full + CSV Export" },
                  { category: "Integrations & Team" }, { label: "Webhook Integrations", starter: false, pro: true, biz: true },
                  { label: "Broadcast Campaigns / Mo", starter: "None", pro: "5", biz: "Unlimited" },
                  { label: "Team Members", starter: "1 (Owner)", pro: "3", biz: "Unlimited" },
                  { category: "Support" }, { label: "Support", starter: "Email", pro: "Priority Email", biz: "Dedicated" },
                  { label: "14-Day Free Trial", starter: true, pro: true, biz: true },
                ].map((row, i) => {
                  if (row.category) return (<tr key={i}><td colSpan={4} style={{ padding: "var(--space-lg) var(--space-lg) var(--space-sm)", fontWeight: 700, fontSize: "var(--font-size-xs)", letterSpacing: "0.08em", color: "var(--text-tertiary)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-glass)" }}>{row.category}</td></tr>);
                  const renderCell = (val) => { if (val === true) return <span style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: 18 }}>&#10003;</span>; if (val === false) return <span style={{ color: "var(--text-tertiary)", fontSize: 16 }}>&mdash;</span>; return <span style={{ fontWeight: 500 }}>{val}</span>; };
                  return (<tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}><td style={{ padding: "var(--space-md) var(--space-lg)", color: "var(--text-secondary)" }}>{row.label}</td><td style={{ padding: "var(--space-md)", textAlign: "center" }}>{renderCell(row.starter)}</td><td style={{ padding: "var(--space-md)", textAlign: "center", background: "rgba(79, 70, 229, 0.05)" }}>{renderCell(row.pro)}</td><td style={{ padding: "var(--space-md)", textAlign: "center" }}>{renderCell(row.biz)}</td></tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== PRICING FAQ ===== */}
      <section className="section" id="faq" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className="section-header" style={{ marginBottom: 40 }}>
            <span className="section-badge">FAQ</span>
            <h2 className="section-title">Pricing Questions</h2>
            <p className="section-subtitle">Everything you need to know about Sellora's pricing</p>
          </div>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { q: "Is there a free trial?", a: "Yes! Every plan comes with a 14-day free trial. No credit card required. You get full access to all features during the trial." },
              { q: "Do I need a WhatsApp Business account?", a: "Yes, you need a WhatsApp Business API account (via Meta Developer). We provide step-by-step instructions to set it up — it takes about 10 minutes." },
              { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time from the Billing page. No cancellation fees, no questions asked." },
              { q: "What payment methods do you accept?", a: "We accept Paymob (Visa, Mastercard, Meeza, Vodafone Cash), Fawry, and InstaPay for EGP payments. Stripe is available for international USD payments." },
              { q: "Is there a setup fee?", a: "No. There are no setup fees, no hidden costs. You only pay the monthly subscription." },
              { q: "What happens if I exceed my plan limits?", a: "We'll notify you when you're approaching your limits. You can upgrade at any time. We never cut off service without warning." },
              { q: "Do you offer custom enterprise plans?", a: "Yes! For teams with 10+ agents or custom requirements, contact us at support@sellora.app for a tailored plan." },
              { q: "Can I switch plans later?", a: "Yes, you can upgrade or downgrade your plan at any time from the Billing page. Changes take effect immediately and we prorate the difference." },
            ].map((faq, i) => (
              <details key={i} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12, padding: "16px 20px", cursor: "pointer",
              }}>
                <summary style={{ fontSize: 15, fontWeight: 600, color: "#fff", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {faq.q}
                  <span style={{ color: "var(--accent-primary-light)", fontSize: 18 }}>+</span>
                </summary>
                <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS — FLOATING GLASS ===== */}
      <section className="section testimonials" id="testimonials">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-green" style={{ marginBottom: 16 }}><Star size={12} />{t("testimonials_badge")}</span>
            <h2 className="section-title-reveal">{t("testimonials_title")}</h2>
            <p>{t("testimonials_subtitle")}</p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((tItem, i) => (
              <motion.div key={i} className="glass-card testimonial-card"
                initial={{ opacity: 0, y: 30 + (i % 2) * 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
              >
                <div className="testimonial-stars">{[...Array(5)].map((_, j) => (<Star key={j} size={14} fill="currentColor" />))}</div>
                <p className="testimonial-text">&quot;{tItem.text}&quot;</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{tItem.initials}</div>
                  <div className="testimonial-info"><h4>{tItem.name}</h4><p>{tItem.role}</p></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" id="faq">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><MessageCircle size={12} />{t("faq_badge")}</span>
            <h2 className="section-title-reveal">{t("faq_title_1")} <span className="text-gradient-static">{t("faq_title_2")}</span></h2>
          </div>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} id={`faq-${i}`}>{faq.q}<Plus size={18} className="faq-icon" /></button>
                <div className="faq-answer"><p>{faq.a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA — IMMERSIVE ===== */}
      <SVGWaveDivider />
      <section className="section cta-section" id="cta">
        <div className="section-inner">
          <div className="cta-box animate-on-scroll">
            <div className="cta-box-glow" />
            {/* Animated background gradient */}
            <div className="cta-animated-bg" />
            <h2>Your Next Customer <span className="text-gradient-static">Won&apos;t Wait.</span></h2>
            <p>Start growing with Sellora today. Every minute you wait is a sale your competitor just closed.</p>
            <div className="cta-form">
              <input type="email" className="cta-input" placeholder={t("cta_placeholder")} id="cta-email" />
              <MagneticButton>
                <button className="btn btn-primary magnetic-btn" id="cta-submit" onClick={() => router.push('/signup')}>Start Growing with Sellora <ArrowRight size={16} /></button>
              </MagneticButton>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer" id="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a href="#" className="navbar-logo">
                <img src="/logo.png" alt="Sellora" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <span>Sell<span className="text-gradient-static">ora</span></span>
              </a>
              <p>{t("footer_desc")}</p>
              {/* Email capture */}
              <div style={{ marginTop: 16, display: "flex", gap: 8, maxWidth: 320 }}>
                <input
                  type="email"
                  placeholder="Enter your email for updates"
                  id="footer-email-capture"
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none" }}
                />
                <button
                  onClick={async () => {
                    const email = document.getElementById("footer-email-capture")?.value;
                    if (!email) return;
                    try {
                      await fetch("/api/notifications/email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "newsletter_signup", email }),
                      });
                      const input = document.getElementById("footer-email-capture");
                      if (input) { input.value = ""; input.placeholder = "✓ Subscribed!"; }
                    } catch (e) { /* ignore */ }
                  }}
                  style={{ padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg, #5865F2, #00D2FF)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  Subscribe
                </button>
              </div>
            </div>
            <div className="footer-col">
              <h4>{t("footer_product")}</h4>
              <a href="#features" onClick={preventNav}>{t("footer_features")}</a>
              <a href="#pricing" onClick={preventNav}>{t("footer_pricing")}</a>
              <a href="#how-it-works" onClick={preventNav}>{t("footer_how")}</a>
              <a href="#integrations" onClick={preventNav}>{t("footer_integrations")}</a>
              <a href="/api-docs" onClick={preventNav}>{t("footer_api")}</a>
            </div>
            <div className="footer-col">
              <h4>{t("footer_company")}</h4>
              <a href="/about" onClick={preventNav}>{t("footer_about")}</a>
              <a href="/blog" onClick={preventNav}>{t("footer_blog")}</a>
              <a href="/careers" onClick={preventNav}>{t("footer_careers")}</a>
              <a href="mailto:support@sellora.app" onClick={preventNav}>{t("footer_contact")}</a>
            </div>
            <div className="footer-col">
              <h4>{t("footer_legal")}</h4>
              <a href="/privacy" onClick={preventNav}>{t("footer_privacy")}</a>
              <a href="/terms" onClick={preventNav}>{t("footer_terms")}</a>
              <a href="/gdpr" onClick={preventNav}>{t("footer_gdpr")}</a>
              <a href="/security" onClick={preventNav}>{t("footer_security")}</a>
            </div>
          </div>
          <div className="footer-extra-links">
            <a href="/help" onClick={preventNav}>Help Center</a>
            <a href="/blog" onClick={preventNav}>Blog</a>
            <a href="/affiliates" onClick={preventNav}>Affiliates</a>
            <a href="/status" onClick={preventNav}>Status</a>
          </div>
          <div className="footer-bottom">
            <p>{t("footer_copyright")}</p>
            <div className="footer-social">
              <a href="#" aria-label="Twitter"><Globe size={16} /></a>
              <a href="#" aria-label="LinkedIn"><Users size={16} /></a>
              <a href="#" aria-label="Instagram"><MessageCircle size={16} /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp floating button — marketing site lead capture */}
      <a
        href="https://wa.me/20128200932?text=Hi!%20I'm%20interested%20in%20Sellora%20for%20my%20business"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#25D366",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(37, 211, 102, 0.4)",
          zIndex: 999,
          transition: "transform 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        title="Chat with us on WhatsApp"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </SmoothScrollProvider>
  );
}
