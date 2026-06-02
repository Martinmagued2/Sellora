"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  ShoppingBag,
  Users,
  BarChart3,
  Zap,
  Send,
  Bot,
  Package,
  CreditCard,
  TrendingUp,
  Check,
  Plus,
  ChevronRight,
  Star,
  ArrowRight,
  Menu,
  X,
  Clock,
  AlertTriangle,
  Copy,
  Megaphone,
  Globe,
  Shield,
  Sun,
  Moon,
  Sparkles,
  Play,
} from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/* ──────────────────────────────────────────────
   PARTICLE CANVAS — interactive background
   ────────────────────────────────────────────── */
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

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    const count = Math.min(80, Math.floor(window.innerWidth / 18));
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? "108,92,231" : "0,210,255",
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const ps = particles.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];

        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (180 - dist) / 180 * 0.8;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Dampen
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},0.6)`;
        ctx.fill();

        // Connect nearby particles with lines
        for (let j = i + 1; j < ps.length; j++) {
          const p2 = ps[j];
          const d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 140) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${p.color},${0.15 * (1 - d / 140)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      rafId.current = requestAnimationFrame(draw);
    }
    draw();

    const handleMouse = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleLeave = () => {
      mouse.current = { x: -1000, y: -1000 };
    };
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("mouseleave", handleLeave);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

/* ──────────────────────────────────────────────
   ANIMATED COUNTER — counts up on scroll
   ────────────────────────────────────────────── */
function AnimatedCounter({ end, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const duration = 2000;
          const start = performance.now();
          function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setValue(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

/* ──────────────────────────────────────────────
   TILT CARD — 3D perspective tilt on hover
   ────────────────────────────────────────────── */
function TiltCard({ children, className = "", style = {} }) {
  const cardRef = useRef(null);

  const handleMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / centerY * -6;
    const rotateY = (x - centerX) / centerX * 6;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`;
  }, []);

  const handleLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, transition: "transform 0.15s ease-out", transformStyle: "preserve-3d" }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────
   TYPING ANIMATION
   ────────────────────────────────────────────── */
function TypingText({ strings, speed = 80, deleteSpeed = 40, pause = 2000 }) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = strings[idx];
    let timer;
    if (!isDeleting && charIdx < current.length) {
      timer = setTimeout(() => {
        setText(current.slice(0, charIdx + 1));
        setCharIdx(charIdx + 1);
      }, speed);
    } else if (!isDeleting && charIdx === current.length) {
      timer = setTimeout(() => setIsDeleting(true), pause);
    } else if (isDeleting && charIdx > 0) {
      timer = setTimeout(() => {
        setText(current.slice(0, charIdx - 1));
        setCharIdx(charIdx - 1);
      }, deleteSpeed);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setIdx((idx + 1) % strings.length);
    }
    return () => clearTimeout(timer);
  }, [charIdx, isDeleting, idx, strings, speed, deleteSpeed, pause]);

  return (
    <span>
      {text}
      <span className="typing-cursor">|</span>
    </span>
  );
}

/* ──────────────────────────────────────────────
   LIVE CHAT MOCKUP — interactive typing demo
   ────────────────────────────────────────────── */
function LiveChatMockup() {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const started = useRef(false);

  const chatScript = [
    { role: "customer", text: "Hi! How much is the black bag?", delay: 800 },
    { role: "typing", delay: 600 },
    { role: "ai", text: "Hey there! The Black Leather Tote is 450 EGP. Want me to share a photo?", delay: 1000 },
    { role: "customer", text: "Yes please!", delay: 1200 },
    { role: "typing", delay: 500 },
    { role: "ai", text: "Here it is! We also have it in brown. Want to order?", delay: 800 },
    { role: "customer", text: "I'll take the black one!", delay: 1000 },
    { role: "typing", delay: 400 },
    { role: "ai", text: "Great choice! Payment link sent. Your order #2847 is confirmed!", delay: 600 },
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let timeout;
    let i = 0;
    function next() {
      if (i >= chatScript.length) {
        // Restart after 5s
        timeout = setTimeout(() => {
          setMessages([]);
          started.current = false;
          i = 0;
        }, 5000);
        return;
      }
      const step = chatScript[i];
      if (step.role === "typing") {
        setTyping(true);
        timeout = setTimeout(() => {
          setTyping(false);
          i++;
          next();
        }, step.delay);
      } else {
        timeout = setTimeout(() => {
          setMessages((prev) => [...prev, { role: step.role, text: step.text }]);
          i++;
          next();
        }, step.delay);
      }
    }
    next();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-lg)",
      backdropFilter: "blur(16px)",
      maxWidth: 380,
      margin: "0 auto",
    }}>
      {/* Chat header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-sm)",
        paddingBottom: "var(--space-md)", borderBottom: "1px solid var(--border-subtle)",
        marginBottom: "var(--space-md)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent-gradient)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bot size={18} style={{ color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Sellora AI</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }} />
            Online
          </div>
        </div>
      </div>
      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", minHeight: 220 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "customer" ? "flex-start" : "flex-end",
            maxWidth: "80%",
            padding: "10px 14px",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--font-size-sm)",
            lineHeight: 1.5,
            background: m.role === "customer"
              ? "var(--bg-glass)"
              : "rgba(108,92,231,0.15)",
            border: `1px solid ${m.role === "customer" ? "var(--border-subtle)" : "rgba(108,92,231,0.2)"}`,
            animation: "chatMsgIn 0.3s ease-out",
          }}>
            {m.text}
          </div>
        ))}
        {typing && (
          <div style={{
            alignSelf: "flex-end",
            padding: "10px 16px",
            borderRadius: "var(--radius-lg)",
            background: "rgba(108,92,231,0.1)",
            border: "1px solid rgba(108,92,231,0.15)",
            display: "flex", gap: 4, alignItems: "center",
          }}>
            <span className="chat-dot" />
            <span className="chat-dot" />
            <span className="chat-dot" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MORPHING BLOB — animated SVG background shape
   ────────────────────────────────────────────── */
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
        <animate
          attributeName="d"
          dur="12s"
          repeatCount="indefinite"
          values="
            M300,100 C450,50 550,180 520,300 C490,420 380,520 260,500 C140,480 50,380 80,250 C110,120 150,150 300,100 Z;
            M300,80 C420,60 580,200 500,320 C420,440 350,530 230,510 C110,490 30,350 100,220 C170,90 180,100 300,80 Z;
            M300,120 C480,80 530,220 490,340 C450,460 340,500 240,480 C140,460 70,360 120,240 C170,120 120,160 300,120 Z;
            M300,100 C450,50 550,180 520,300 C490,420 380,520 260,500 C140,480 50,380 80,250 C110,120 150,150 300,100 Z
          "
        />
      </path>
    </svg>
  );
}

/* ──────────────────────────────────────────────
   MARQUEE — scrolling ticker
   ────────────────────────────────────────────── */
function Marquee({ children, speed = 30 }) {
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        {children}{children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN HOMEPAGE
   ══════════════════════════════════════════════ */
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

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll animations + parallax
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));

    // Parallax on scroll
    const handleParallax = () => {
      const scrollY = window.scrollY;
      document.querySelectorAll("[data-parallax]").forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        el.style.transform = `translateY(${scrollY * speed}px)`;
      });
    };
    window.addEventListener("scroll", handleParallax);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleParallax);
    };
  }, []);

  // Cursor glow follower
  useEffect(() => {
    const handleMouse = (e) => {
      setCursorGlow({ x: e.clientX, y: e.clientY, visible: true });
    };
    const handleLeave = () => setCursorGlow((p) => ({ ...p, visible: false }));
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const features = [
    {
      icon: <Bot size={24} />,
      color: "purple",
      title: "AI Auto-Replies",
      desc: "Instant, intelligent responses across WhatsApp, Instagram & Facebook DMs in Arabic & English. Never miss a sale — even at 3 AM.",
    },
    {
      icon: <Package size={24} />,
      color: "blue",
      title: "Product Catalog",
      desc: "Beautiful product listings shared seamlessly across all channels. Customers browse, ask questions, and order — all in one chat.",
    },
    {
      icon: <ShoppingBag size={24} />,
      color: "green",
      title: "Order Management",
      desc: "Track every order from placement to delivery. Status updates sent automatically to customers across WhatsApp, Instagram & Facebook.",
    },
    {
      icon: <CreditCard size={24} />,
      color: "orange",
      title: "Payment Links",
      desc: "Auto-send payment links via Fawry, InstaPay, Vodafone Cash, Stripe, or PayPal. Get paid instantly.",
    },
    {
      icon: <Users size={24} />,
      color: "pink",
      title: "Customer CRM",
      desc: "Unified inbox for all channels. Track repeat buyers, purchase history, and preferences across WhatsApp, Instagram & Facebook.",
    },
    {
      icon: <Megaphone size={24} />,
      color: "red",
      title: "Broadcast Campaigns",
      desc: "Send targeted promotions to customer segments across all platforms. New product? Flash sale? Reach thousands in one click.",
    },
  ];

  const pricingPlans = [
    {
      tier: "STARTER",
      name: "Starter",
      desc: "Perfect for solo sellers just getting started",
      price: isAnnual ? 399 : 499,
      features: [
        "1 connected channel (WA, IG or FB)",
        "25 products",
        "50 AI replies/day (Fast AI)",
        "100 conversations/mo",
        "30-day message history",
        "Basic analytics",
        "Email support",
      ],
      cta: "Start Free Trial",
      featured: false,
    },
    {
      tier: "MOST POPULAR",
      name: "Professional",
      desc: "For growing businesses that need AI power",
      price: isAnnual ? 999 : 1299,
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
      cta: "Start Free Trial",
      featured: true,
    },
    {
      tier: "BUSINESS",
      name: "Business",
      desc: "For teams managing multiple brands at scale",
      price: isAnnual ? 2499 : 2999,
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
      cta: "Contact Sales",
      featured: false,
    },
  ];

  const testimonials = [
    {
      text: "Sellora saved me 4 hours every day. I used to reply to 200+ messages manually — now AI handles 80% of them perfectly.",
      name: "Nour Ahmed",
      role: "Opio Franchise Owner, Cairo",
      initials: "NA",
    },
    {
      text: "My orders went up 3x in the first month. Customers love browsing my catalog right inside WhatsApp. It's like having a store in their pocket.",
      name: "Omar Hassan",
      role: "Town Team Branch Manager, Alexandria",
      initials: "OH",
    },
    {
      text: "As an agency, we manage multiple local clothing brands like Ravin and Cottonil. Sellora lets us handle all of them from one dashboard. The ROI is insane.",
      name: "Sara Youssef",
      role: "Digital Marketing Agency, Mansoura",
      initials: "SY",
    },
  ];

  const faqs = [
    {
      q: "Do I need a WhatsApp Business API account?",
      a: "We help you set everything up! When you sign up, we guide you through connecting your WhatsApp Business number. The process takes about 10 minutes. You'll need a Meta Business account (free) and a dedicated phone number.",
    },
    {
      q: "Does it work with regular WhatsApp or Instagram?",
      a: "Sellora works with the WhatsApp Business API, Instagram Business, and Facebook Messenger. We support all three platforms from a single unified dashboard, so you can manage all your conversations in one place.",
    },
    {
      q: "Can the AI reply in Arabic?",
      a: "Absolutely! Our AI is fluent in both Arabic and English, and can switch between languages automatically based on what your customer writes. It also understands Egyptian dialect, Gulf Arabic, and formal Arabic.",
    },
    {
      q: "What payment methods are supported?",
      a: "We support Fawry, InstaPay, Vodafone Cash, Orange Cash for Egypt. For international customers: Stripe, PayPal, and bank transfers. More local payment methods are being added regularly.",
    },
    {
      q: "Can I try it for free?",
      a: "Yes! Every plan comes with a 14-day free trial — no credit card required. You can test all features and see the impact on your business before committing.",
    },
    {
      q: "Is my data secure?",
      a: "100%. We use bank-level encryption (AES-256), all data is stored in secure cloud infrastructure, and we never share your customer data with third parties. We're also GDPR compliant.",
    },
  ];

  return (
    <>
      {/* Particle Canvas Background */}
      <ParticleCanvas />

      {/* Cursor Glow Follower */}
      <div
        className="cursor-glow"
        style={{
          left: cursorGlow.x - 200,
          top: cursorGlow.y - 200,
          opacity: cursorGlow.visible ? 1 : 0,
        }}
      />

      {/* ===== NAVBAR ===== */}
      <nav className={`navbar ${isScrolled ? "scrolled" : ""}`} id="navbar">
        <div className="navbar-inner">
          <a href="#" className="navbar-logo">
            <img src="/logo.png" alt="Sellora" className="navbar-logo-img" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <span>
              Sell<span className="text-gradient-static">ora</span>
            </span>
          </a>

          <div className="navbar-links">
            <a href="#features">{t("nav_features")}</a>
            <a href="#how-it-works">{t("nav_how")}</a>
            <a href="#pricing">{t("nav_pricing")}</a>
            <a href="#faq">{t("nav_faq")}</a>
          </div>

          <div className="navbar-actions">
            <button className="navbar-icon-btn" onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="lang-switcher" style={{ position: "relative" }}>
              <button className="navbar-icon-btn" onClick={() => setLangMenuOpen(!langMenuOpen)} title="Change language" aria-label="Change language">
                <Globe size={18} />
                <span style={{ fontSize: "var(--font-size-xs)", marginLeft: 4 }}>{lang.toUpperCase()}</span>
              </button>
              {langMenuOpen && (
                <div className="lang-dropdown">
                  <button className={`lang-option ${lang === "en" ? "active" : ""}`} onClick={() => { setLang("en"); setLangMenuOpen(false); }}>English</button>
                  <button className={`lang-option ${lang === "ar" ? "active" : ""}`} onClick={() => { setLang("ar"); setLangMenuOpen(false); }}>العربية</button>
                  <button className={`lang-option ${lang === "fr" ? "active" : ""}`} onClick={() => { setLang("fr"); setLangMenuOpen(false); }}>Français</button>
                </div>
              )}
            </div>

            <button className="navbar-login" onClick={() => router.push("/login")}>{t("nav_login")}</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push("/signup")}>
              {t("nav_get_started")} <ArrowRight size={14} />
            </button>
          </div>

          <button className="navbar-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <a href="#features" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_features")}</a>
            <a href="#how-it-works" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_how")}</a>
            <a href="#pricing" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_pricing")}</a>
            <a href="#testimonials" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_testimonials")}</a>
            <a href="#faq" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_faq")}</a>
            <div className="mobile-menu-actions">
              <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/login"); }}>{t("nav_login")}</button>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/signup"); }}>{t("nav_get_started")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HERO ===== */}
      <section className="hero hero-v2" id="hero">
        <MorphBlob color="purple" style={{ top: "-10%", right: "-5%", width: "60vw", maxWidth: 600, opacity: 0.8 }} data-parallax="-0.15" />
        <MorphBlob color="cyan" style={{ bottom: "-5%", left: "-8%", width: "50vw", maxWidth: 500, opacity: 0.6 }} data-parallax="-0.1" />

        <div className="hero-content hero-v2-content" data-parallax="-0.05">
          <div className="hero-badge" style={{ animation: "fade-in-up 0.8s ease" }}>
            <span className="badge badge-primary">
              <Sparkles size={12} />
              {t("hero_badge")}
            </span>
          </div>

          <h1 style={{ animation: "fade-in-up 1s ease" }}>
            {t("hero_title_1")} <span className="text-gradient">{t("hero_title_2")}</span> {t("hero_title_3")}{" "}
            <span className="text-gradient">
              <TypingText strings={["autopilot", "WhatsApp", "Instagram", "Facebook", "autopilot"]} speed={80} deleteSpeed={40} pause={2000} />
            </span>
          </h1>

          <p className="hero-subtitle" style={{ animation: "fade-in-up 1.2s ease" }}>
            {t("hero_subtitle")}
          </p>

          <div className="hero-cta" style={{ animation: "fade-in-up 1.4s ease" }}>
            <button className="btn btn-primary btn-lg hero-cta-btn" id="hero-cta-primary" onClick={() => router.push("/signup")}>
              <Play size={18} />
              {t("hero_cta_primary")}
            </button>
            <button className="btn btn-secondary btn-lg" id="hero-cta-demo" onClick={() => router.push("/login")}>
              {t("hero_cta_secondary")} <ChevronRight size={18} />
            </button>
          </div>

          <div className="hero-stats" style={{ animation: "fade-in-up 1.6s ease" }}>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static">
                <AnimatedCounter end={2500} suffix="+" />
              </div>
              <div className="hero-stat-label">{t("hero_stat_sellers")}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static">
                <AnimatedCounter end={1200000} suffix="+" />
              </div>
              <div className="hero-stat-label">{t("hero_stat_messages")}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static">
                <AnimatedCounter end={98} suffix="%" />
              </div>
              <div className="hero-stat-label">{t("hero_stat_uptime")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF MARQUEE ===== */}
      <section className="social-proof-v2">
        <Marquee speed={25}>
          {[
            { icon: "🇪🇬", name: "Egypt" },
            { icon: "🇸🇦", name: "Saudi Arabia" },
            { icon: "🇦🇪", name: "UAE" },
            { icon: "🇮🇳", name: "India" },
            { icon: "🇧🇷", name: "Brazil" },
            { icon: "🇳🇬", name: "Nigeria" },
            { icon: "🇰🇼", name: "Kuwait" },
            { icon: "🇲🇦", name: "Morocco" },
          ].map((c, i) => (
            <span key={i} className="marquee-item">
              <span style={{ fontSize: 24 }}>{c.icon}</span>
              <span style={{ fontWeight: 700, letterSpacing: 1 }}>{c.name}</span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* ===== PROBLEM + LIVE CHAT DEMO ===== */}
      <section className="section problem" id="problem">
        <div className="section-inner">
          <div className="problem-grid">
            <div className="problem-content animate-on-scroll">
              <span className="badge badge-primary" style={{ marginBottom: 16 }}>
                <AlertTriangle size={12} />
                The Problem
              </span>
              <h2>
                You&apos;re losing sales in your{" "}
                <span className="text-gradient-static">DMs</span> right now
              </h2>
              <p>
                Every unanswered message is a lost customer. Every delayed reply
                is money left on the table. Here&apos;s what&apos;s happening:
              </p>

              <div className="problem-list">
                <div className="problem-item">
                  <div className="problem-item-icon"><Clock size={18} /></div>
                  <div className="problem-item-text">
                    <h4>Missed messages at night</h4>
                    <p>60% of customers message between 10PM-2AM. You&apos;re asleep, they buy from someone else.</p>
                  </div>
                </div>
                <div className="problem-item">
                  <div className="problem-item-icon"><Copy size={18} /></div>
                  <div className="problem-item-text">
                    <h4>Copy-pasting prices all day</h4>
                    <p>You spend 3+ hours/day answering &quot;How much is this?&quot; and &quot;Is it available?&quot; manually.</p>
                  </div>
                </div>
                <div className="problem-item">
                  <div className="problem-item-icon"><AlertTriangle size={18} /></div>
                  <div className="problem-item-text">
                    <h4>Lost orders in chat history</h4>
                    <p>No tracking. No system. Orders get mixed up, customers get frustrated, you lose repeat business.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="problem-visual animate-on-scroll">
              <LiveChatMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="section" id="features">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-green" style={{ marginBottom: 16 }}>
              <Zap size={12} />
              {t("features_badge")}
            </span>
            <h2>
              {t("features_title_1")}{" "}
              <span className="text-gradient-static">{t("features_title_2")}</span>
            </h2>
            <p>{t("features_subtitle")}</p>
          </div>

          <div className="features-grid">
            {features.map((feature, i) => (
              <TiltCard
                key={i}
                className="glass-card feature-card animate-on-scroll"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`feature-icon ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
                <div className="feature-card-shine" />
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section how-it-works" id="how-it-works">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}>
              <Globe size={12} />
              {t("how_badge")}
            </span>
            <h2>
              {t("how_title_1")}{" "}
              <span className="text-gradient-static">{t("how_title_2")}</span>{" "}
              {t("how_title_3")}
            </h2>
          </div>

          <div className="steps-container">
            {[
              { num: 1, title: "Connect WhatsApp", desc: "Link your WhatsApp Business number in 2 clicks. We handle all the technical setup — API, webhooks, verification.", icon: <MessageCircle size={28} /> },
              { num: 2, title: "Add Your Products", desc: "Upload your catalog or import from Instagram. Set prices, add photos, manage variants and stock — all from your dashboard.", icon: <Package size={28} /> },
              { num: 3, title: "Start Selling 24/7", desc: "AI handles inquiries, shows products, takes orders, and sends payment links — even while you sleep. See everything in real-time.", icon: <Zap size={28} /> },
            ].map((step, i) => (
              <div key={i} className="step-card animate-on-scroll" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="step-number-wrap">
                  <div className="step-number-ring">
                    <div className="step-number">{step.num}</div>
                  </div>
                  <div className="step-number-icon">{step.icon}</div>
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}>
              <CreditCard size={12} />
              {t("pricing_badge")}
            </span>
            <h2>
              {t("pricing_title_1")}{" "}
              <span className="text-gradient-static">{t("pricing_title_2")}</span>
            </h2>
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
              <TiltCard
                key={i}
                className={`glass-card pricing-card animate-on-scroll ${plan.featured ? "featured" : ""}`}
              >
                {plan.featured && (
                  <div className="pricing-popular">
                    <span className="badge badge-primary">Most Popular</span>
                  </div>
                )}
                <div className="pricing-tier">{plan.tier}</div>
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-desc">{plan.desc}</div>
                <div className="pricing-price">
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-currency" style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, alignSelf: "baseline", marginBottom: 2 }}>{lang === "en" ? " EGP" : " جنيه"}</span>
                  <span className="pricing-period">/month</span>
                </div>
                <div className="pricing-features">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="pricing-feature">
                      <div className="pricing-feature-check"><Check size={12} /></div>
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"} btn-lg`}
                  id={`pricing-cta-${i}`}
                  onClick={() => router.push("/signup")}
                >
                  {plan.cta}
                </button>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="section" id="comparison" style={{ paddingTop: 0 }}>
        <div className="section-inner">
          <div className="animate-on-scroll" style={{ overflowX: "auto" }}>
            <h3 style={{ textAlign: "center", marginBottom: "var(--space-xl)", fontSize: "var(--font-size-xl)", fontWeight: 700 }}>
              Full Feature <span className="text-gradient-static">Comparison</span>
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "var(--space-md) var(--space-lg)", color: "var(--text-tertiary)", fontWeight: 600, borderBottom: "1px solid var(--border-subtle)" }}>Feature</th>
                  {[
                    { name: "Starter", color: "var(--accent-green)" },
                    { name: "Professional", color: "var(--accent-primary-light)" },
                    { name: "Business", color: "var(--accent-orange)" },
                  ].map((p) => (
                    <th key={p.name} style={{ textAlign: "center", padding: "var(--space-md) var(--space-lg)", fontWeight: 700, color: p.color, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { category: "AI & Automation" },
                  { label: "AI Model", starter: "Fast (Llama 3)", pro: "Smart (GPT-4o Mini)", biz: "Premium (GPT-4o)" },
                  { label: "AI Replies / Day", starter: "50", pro: "500", biz: "Unlimited" },
                  { label: "Custom AI Personality", starter: false, pro: true, biz: true },
                  { category: "Scale & Limits" },
                  { label: "Connected Channels", starter: "1", pro: "2", biz: "3 (All)" },
                  { label: "Products", starter: "25", pro: "Unlimited", biz: "Unlimited" },
                  { label: "Conversations / Month", starter: "100", pro: "1,000", biz: "Unlimited" },
                  { category: "Data & Integrations" },
                  { label: "Message History", starter: "30 days", pro: "6 months", biz: "Unlimited" },
                  { label: "Broadcast Campaigns / Mo", starter: "None", pro: "5", biz: "Unlimited" },
                  { label: "Team Members", starter: "1 (Owner)", pro: "3", biz: "Unlimited" },
                ].map((row, i) => {
                  if (row.category) {
                    return (
                      <tr key={i}>
                        <td colSpan={4} style={{ padding: "var(--space-lg) var(--space-lg) var(--space-sm)", fontWeight: 700, fontSize: "var(--font-size-xs)", letterSpacing: "0.08em", color: "var(--text-tertiary)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-glass)" }}>
                          {row.category}
                        </td>
                      </tr>
                    );
                  }
                  const renderCell = (val) => {
                    if (val === true) return <span style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: 18 }}>✓</span>;
                    if (val === false) return <span style={{ color: "var(--text-tertiary)", fontSize: 16 }}>—</span>;
                    return <span style={{ fontWeight: 500 }}>{val}</span>;
                  };
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "var(--space-md) var(--space-lg)", color: "var(--text-secondary)" }}>{row.label}</td>
                      <td style={{ padding: "var(--space-md)", textAlign: "center" }}>{renderCell(row.starter)}</td>
                      <td style={{ padding: "var(--space-md)", textAlign: "center", background: "rgba(108, 92, 231, 0.05)" }}>{renderCell(row.pro)}</td>
                      <td style={{ padding: "var(--space-md)", textAlign: "center" }}>{renderCell(row.biz)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="section testimonials" id="testimonials">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-green" style={{ marginBottom: 16 }}>
              <Star size={12} />
              {t("testimonials_badge")}
            </span>
            <h2>{t("testimonials_title")}</h2>
            <p>{t("testimonials_subtitle")}</p>
          </div>

          <div className="testimonials-grid">
            {testimonials.map((tItem, i) => (
              <TiltCard key={i} className="glass-card testimonial-card animate-on-scroll">
                <div className="testimonial-stars">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="testimonial-text">&quot;{tItem.text}&quot;</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{tItem.initials}</div>
                  <div className="testimonial-info">
                    <h4>{tItem.name}</h4>
                    <p>{tItem.role}</p>
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" id="faq">
        <div className="section-inner">
          <div className="section-header animate-on-scroll">
            <span className="badge badge-primary" style={{ marginBottom: 16 }}>
              <MessageCircle size={12} />
              {t("faq_badge")}
            </span>
            <h2>
              {t("faq_title_1")}{" "}
              <span className="text-gradient-static">{t("faq_title_2")}</span>
            </h2>
          </div>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)} id={`faq-${i}`}>
                  {faq.q}
                  <Plus size={18} className="faq-icon" />
                </button>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="section cta-section" id="cta">
        <div className="section-inner">
          <div className="cta-box animate-on-scroll">
            <div className="cta-box-glow" />
            <MorphBlob color="purple" style={{ top: "-40%", left: "-20%", width: 300, opacity: 0.5 }} />
            <h2>
              {t("cta_title_1")} <span className="text-gradient-static">{t("cta_title_2")}</span>{" "}
              {t("cta_title_3")}
            </h2>
            <p>{t("cta_subtitle")}</p>
            <div className="cta-form">
              <input type="email" className="cta-input" placeholder={t("cta_placeholder")} id="cta-email" />
              <button className="btn btn-primary" id="cta-submit" onClick={() => router.push("/signup")}>
                {t("cta_button")} <ArrowRight size={16} />
              </button>
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
            </div>

            <div className="footer-col">
              <h4>{t("footer_product")}</h4>
              <a href="#features">{t("footer_features")}</a>
              <a href="#pricing">{t("footer_pricing")}</a>
              <a href="#how-it-works">{t("footer_how")}</a>
              <a href="#">{t("footer_integrations")}</a>
              <a href="#">{t("footer_api")}</a>
            </div>

            <div className="footer-col">
              <h4>{t("footer_company")}</h4>
              <a href="#">{t("footer_about")}</a>
              <a href="#">{t("footer_blog")}</a>
              <a href="#">{t("footer_careers")}</a>
              <a href="#">{t("footer_contact")}</a>
            </div>

            <div className="footer-col">
              <h4>{t("footer_legal")}</h4>
              <a href="#">{t("footer_privacy")}</a>
              <a href="#">{t("footer_terms")}</a>
              <a href="#">{t("footer_gdpr")}</a>
              <a href="#">{t("footer_security")}</a>
            </div>
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
    </>
  );
}
