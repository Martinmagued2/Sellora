"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
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
  Phone,
  Headphones,
  ShoppingCart,
  MessageSquare,
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
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (180 - dist) / 180 * 0.8;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},0.6)`;
        ctx.fill();

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

    const handleMouse = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const handleLeave = () => { mouse.current = { x: -1000, y: -1000 }; };
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
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
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
            const eased = 1 - Math.pow(1 - progress, 3);
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
   SCROLL REVEAL — framer motion wrapper
   ────────────────────────────────────────────── */
function ScrollReveal({ children, direction = "up", delay = 0, duration = 0.6, className = "", style = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const directions = {
    up: { y: 60, x: 0 },
    down: { y: -60, x: 0 },
    left: { y: 0, x: -60 },
    right: { y: 0, x: 60 },
    none: { y: 0, x: 0 },
  };

  const d = directions[direction] || directions.up;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, x: d.x, y: d.y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: d.x, y: d.y }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   SCALE ON SCROLL — elements that "come closer"
   ────────────────────────────────────────────── */
function ScaleOnScroll({ children, className = "", style = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.5, rotateX: 15 }}
      animate={isInView ? { opacity: 1, scale: 1, rotateX: 0 } : { opacity: 0, scale: 0.5, rotateX: 15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", minHeight: 220 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "customer" ? "flex-start" : "flex-end",
            maxWidth: "80%",
            padding: "10px 14px",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--font-size-sm)",
            lineHeight: 1.5,
            background: m.role === "customer" ? "var(--bg-glass)" : "rgba(108,92,231,0.15)",
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
            <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
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

/* ──────────────────────────────────────────────
   FLOATING PHONE MOCKUP — 3D phone that rotates with scroll
   ────────────────────────────────────────────── */
function FloatingPhone() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-15, 5, -10]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [10, -5, 8]);
  const scale = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [0.8, 1.05, 1, 0.95]);

  return (
    <div ref={ref} style={{ perspective: 1200 }}>
      <motion.div
        style={{ y, rotateY, rotateX, scale, transformStyle: "preserve-3d" }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="phone-mockup">
          {/* Phone frame */}
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              {/* Mock Sellora dashboard */}
              <div className="phone-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={12} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 11, color: "#fff" }}>Sellora</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)" }} />
                </div>
              </div>
              <div className="phone-messages">
                <div className="phone-msg customer">
                  <span>How much is the black bag?</span>
                  <span className="phone-msg-time">2:34 AM</span>
                </div>
                <div className="phone-msg ai">
                  <span>Black Tote is 450 EGP! Want to order?</span>
                  <span className="phone-msg-time">2:34 AM</span>
                </div>
                <div className="phone-msg customer">
                  <span>Yes, I'll take it!</span>
                  <span className="phone-msg-time">2:35 AM</span>
                </div>
                <div className="phone-msg ai" style={{ background: "rgba(59,165,92,0.2)", borderColor: "rgba(59,165,92,0.3)" }}>
                  <span>Order confirmed! Payment link sent.</span>
                  <span className="phone-msg-time">2:35 AM</span>
                </div>
              </div>
              <div className="phone-input-bar">
                <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>Type a message...</span>
              </div>
            </div>
          </div>
          {/* Floating notification badges around phone */}
          <motion.div
            className="phone-float-badge"
            style={{ top: -20, right: -40 }}
            animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <ShoppingCart size={14} />
            <span>12 Orders</span>
          </motion.div>
          <motion.div
            className="phone-float-badge"
            style={{ bottom: 60, left: -50 }}
            animate={{ y: [0, 8, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <MessageSquare size={14} />
            <span>98% Reply Rate</span>
          </motion.div>
          <motion.div
            className="phone-float-badge"
            style={{ top: 80, left: -60 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <TrendingUp size={14} />
            <span>+340% Sales</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   PRODUCT CARD — individual item that "comes closer" on scroll
   ────────────────────────────────────────────── */
function ProductCard({ product, index }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const y = useTransform(scrollYProgress, [0, 0.5], [80 + index * 20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4, 0.7], [0.5, 0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.6], [0, 0.6, 1]);
  const rotate = useTransform(scrollYProgress, [0, 0.5], [index % 2 === 0 ? -6 : 6, 0]);

  return (
    <motion.div
      ref={ref}
      className={`product-float-card product-color-${product.color}`}
      style={{ y, scale, opacity, rotate }}
    >
      <div className="product-emoji">{product.emoji}</div>
      <div className="product-info">
        <h4>{product.name}</h4>
        <span className="product-price">{product.price}</span>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   PRODUCT SHOWCASE — items that "come closer" on scroll
   ────────────────────────────────────────────── */
function ProductShowcase() {
  const products = [
    { name: "Leather Tote", price: "450 EGP", emoji: "👜", color: "purple" },
    { name: "Sneakers Pro", price: "899 EGP", emoji: "👟", color: "blue" },
    { name: "Smart Watch", price: "2,499 EGP", emoji: "⌚", color: "green" },
    { name: "Perfume Luxe", price: "350 EGP", emoji: "🧴", color: "orange" },
    { name: "Silk Scarf", price: "199 EGP", emoji: "🧣", color: "pink" },
  ];

  return (
    <div className="product-showcase-container">
      {products.map((product, i) => (
        <ProductCard key={i} product={product} index={i} />
      ))}
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

  // Hero scroll progress
  const heroRef = useRef(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(heroScrollProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(heroScrollProgress, [0, 1], [1, 0.9]);
  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 150]);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cursor glow follower
  useEffect(() => {
    const handleMouse = (e) => setCursorGlow({ x: e.clientX, y: e.clientY, visible: true });
    const handleLeave = () => setCursorGlow((p) => ({ ...p, visible: false }));
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const features = [
    { icon: <Bot size={24} />, color: "purple", title: "AI Auto-Replies", desc: "Instant, intelligent responses across WhatsApp, Instagram & Facebook DMs in Arabic & English. Never miss a sale — even at 3 AM." },
    { icon: <Package size={24} />, color: "blue", title: "Product Catalog", desc: "Beautiful product listings shared seamlessly across all channels. Customers browse, ask questions, and order — all in one chat." },
    { icon: <ShoppingBag size={24} />, color: "green", title: "Order Management", desc: "Track every order from placement to delivery. Status updates sent automatically to customers across WhatsApp, Instagram & Facebook." },
    { icon: <CreditCard size={24} />, color: "orange", title: "Payment Links", desc: "Auto-send payment links via Fawry, InstaPay, Vodafone Cash, Stripe, or PayPal. Get paid instantly." },
    { icon: <Users size={24} />, color: "pink", title: "Customer CRM", desc: "Unified inbox for all channels. Track repeat buyers, purchase history, and preferences across WhatsApp, Instagram & Facebook." },
    { icon: <Megaphone size={24} />, color: "red", title: "Broadcast Campaigns", desc: "Send targeted promotions to customer segments across all platforms. New product? Flash sale? Reach thousands in one click." },
  ];

  const pricingPlans = [
    {
      tier: "STARTER", name: "Starter", desc: "Perfect for solo sellers just getting started",
      price: isAnnual ? 399 : 499,
      features: ["1 connected channel (WA, IG or FB)", "25 products", "50 AI replies/day (Fast AI)", "100 conversations/mo", "30-day message history", "Basic analytics", "Email support"],
      cta: "Start Free Trial", featured: false,
    },
    {
      tier: "MOST POPULAR", name: "Professional", desc: "For growing businesses that need AI power",
      price: isAnnual ? 999 : 1299,
      features: ["2 connected channels", "Unlimited products", "500 AI replies/day (Smart AI)", "1,000 conversations/mo", "6-month message history", "Full analytics dashboard", "Webhook integrations", "3 team members", "5 broadcast campaigns/mo", "Priority support"],
      cta: "Start Free Trial", featured: true,
    },
    {
      tier: "BUSINESS", name: "Business", desc: "For teams managing multiple brands at scale",
      price: isAnnual ? 2499 : 2999,
      features: ["All 3 channels", "Unlimited everything", "Unlimited AI (Premium GPT-4o)", "Unlimited conversations", "Unlimited message history", "Full analytics + CSV export", "Webhook integrations", "Unlimited team members", "Unlimited campaigns", "Dedicated support"],
      cta: "Contact Sales", featured: false,
    },
  ];

  const testimonials = [
    { text: "Sellora saved me 4 hours every day. I used to reply to 200+ messages manually — now AI handles 80% of them perfectly.", name: "Nour Ahmed", role: "Opio Franchise Owner, Cairo", initials: "NA" },
    { text: "My orders went up 3x in the first month. Customers love browsing my catalog right inside WhatsApp. It's like having a store in their pocket.", name: "Omar Hassan", role: "Town Team Branch Manager, Alexandria", initials: "OH" },
    { text: "As an agency, we manage multiple local clothing brands like Ravin and Cottonil. Sellora lets us handle all of them from one dashboard. The ROI is insane.", name: "Sara Youssef", role: "Digital Marketing Agency, Mansoura", initials: "SY" },
  ];

  const faqs = [
    { q: "Do I need a WhatsApp Business API account?", a: "We help you set everything up! When you sign up, we guide you through connecting your WhatsApp Business number. The process takes about 10 minutes. You'll need a Meta Business account (free) and a dedicated phone number." },
    { q: "Does it work with regular WhatsApp or Instagram?", a: "Sellora works with the WhatsApp Business API, Instagram Business, and Facebook Messenger. We support all three platforms from a single unified dashboard, so you can manage all your conversations in one place." },
    { q: "Can the AI reply in Arabic?", a: "Absolutely! Our AI is fluent in both Arabic and English, and can switch between languages automatically based on what your customer writes. It also understands Egyptian dialect, Gulf Arabic, and formal Arabic." },
    { q: "What payment methods are supported?", a: "We support Fawry, InstaPay, Vodafone Cash, Orange Cash for Egypt. For international customers: Stripe, PayPal, and bank transfers. More local payment methods are being added regularly." },
    { q: "Can I try it for free?", a: "Yes! Every plan comes with a 14-day free trial — no credit card required. You can test all features and see the impact on your business before committing." },
    { q: "Is my data secure?", a: "100%. We use bank-level encryption (AES-256), all data is stored in secure cloud infrastructure, and we never share your customer data with third parties. We're also GDPR compliant." },
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
            <span>Sell<span className="text-gradient-static">ora</span></span>
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
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-menu-overlay"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mobile-menu"
              onClick={(e) => e.stopPropagation()}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
            >
              <a href="#features" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_features")}</a>
              <a href="#how-it-works" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_how")}</a>
              <a href="#pricing" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_pricing")}</a>
              <a href="#testimonials" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_testimonials")}</a>
              <a href="#faq" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_faq")}</a>
              <div className="mobile-menu-actions">
                <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/login"); }}>{t("nav_login")}</button>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/signup"); }}>{t("nav_get_started")} <ArrowRight size={14} /></button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== HERO ===== */}
      <section className="hero hero-v2" id="hero" ref={heroRef}>
        <MorphBlob color="purple" style={{ top: "-10%", right: "-5%", width: "60vw", maxWidth: 600, opacity: 0.8 }} />
        <MorphBlob color="cyan" style={{ bottom: "-5%", left: "-8%", width: "50vw", maxWidth: 500, opacity: 0.6 }} />

        <motion.div
          className="hero-content hero-v2-content"
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        >
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="badge badge-primary">
              <Sparkles size={12} />
              {t("hero_badge")}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {t("hero_title_1")} <span className="text-gradient">{t("hero_title_2")}</span> {t("hero_title_3")}{" "}
            <span className="text-gradient">
              <TypingText strings={["autopilot", "WhatsApp", "Instagram", "Facebook", "autopilot"]} speed={80} deleteSpeed={40} pause={2000} />
            </span>
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {t("hero_subtitle")}
          </motion.p>

          <motion.div
            className="hero-cta"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <button className="btn btn-primary btn-lg hero-cta-btn" id="hero-cta-primary" onClick={() => router.push("/signup")}>
              <Play size={18} />
              {t("hero_cta_primary")}
            </button>
            <button className="btn btn-secondary btn-lg" id="hero-cta-demo" onClick={() => router.push("/login")}>
              {t("hero_cta_secondary")} <ChevronRight size={18} />
            </button>
          </motion.div>

          <motion.div
            className="hero-stats"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
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
          </motion.div>
        </motion.div>
      </section>

      {/* ===== PHONE MOCKUP + SOCIAL PROOF ===== */}
      <section className="section phone-showcase-section">
        <div className="section-inner">
          <div className="phone-showcase-grid">
            <div className="phone-showcase-left">
              <ScrollReveal direction="right" delay={0.2}>
                <h2 style={{ fontSize: "var(--font-size-3xl)", fontWeight: 800, lineHeight: 1.2, marginBottom: "var(--space-lg)" }}>
                  Your AI sales agent <span className="text-gradient-static">never sleeps</span>
                </h2>
                <p style={{ fontSize: "var(--font-size-lg)", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "var(--space-xl)" }}>
                  While you rest, Sellora handles inquiries, shows products, processes orders, and sends payment links — all on autopilot. Wake up to new sales, not unread messages.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                  {[
                    { icon: <Headphones size={18} />, text: "24/7 auto-reply in Arabic & English" },
                    { icon: <ShoppingCart size={18} />, text: "Auto product catalog sharing" },
                    { icon: <CreditCard size={18} />, text: "Instant payment link generation" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="phone-feature-item"
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.15 }}
                    >
                      <div style={{ color: "var(--accent-primary-light)" }}>{item.icon}</div>
                      <span>{item.text}</span>
                    </motion.div>
                  ))}
                </div>
              </ScrollReveal>
            </div>
            <div className="phone-showcase-right">
              <FloatingPhone />
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
            <div className="problem-content">
              <ScrollReveal direction="left">
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
                  {[
                    { icon: <Clock size={18} />, title: "Missed messages at night", desc: "60% of customers message between 10PM-2AM. You're asleep, they buy from someone else." },
                    { icon: <Copy size={18} />, title: "Copy-pasting prices all day", desc: "You spend 3+ hours/day answering \"How much is this?\" and \"Is it available?\" manually." },
                    { icon: <AlertTriangle size={18} />, title: "Lost orders in chat history", desc: "No tracking. No system. Orders get mixed up, customers get frustrated, you lose repeat business." },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className="problem-item"
                      initial={{ opacity: 0, x: -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.15 }}
                    >
                      <div className="problem-item-icon">{item.icon}</div>
                      <div className="problem-item-text">
                        <h4>{item.title}</h4>
                        <p>{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollReveal>
            </div>

            <div className="problem-visual">
              <ScrollReveal direction="right" delay={0.2}>
                <LiveChatMockup />
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRODUCT SHOWCASE — items "come closer" ===== */}
      <section className="section product-showcase-section-v2" id="products">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
              <span className="badge badge-green" style={{ marginBottom: 16 }}>
                <ShoppingBag size={12} />
                Product Catalog
              </span>
              <h2>
                Your products{" "}
                <span className="text-gradient-static">come alive</span>{" "}
                in every chat
              </h2>
              <p>Share your entire catalog inside WhatsApp, Instagram & Facebook. Customers browse, pick, and order — without ever leaving the conversation.</p>
            </div>
          </ScrollReveal>

          <ProductShowcase />
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="section" id="features">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
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
          </ScrollReveal>

          <div className="features-grid">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <TiltCard className="glass-card feature-card" style={{ height: "100%" }}>
                  <div className={`feature-icon ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                  <div className="feature-card-shine" />
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section how-it-works" id="how-it-works">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
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
          </ScrollReveal>

          <div className="steps-container">
            {[
              { num: 1, title: "Connect WhatsApp", desc: "Link your WhatsApp Business number in 2 clicks. We handle all the technical setup — API, webhooks, verification.", icon: <MessageCircle size={28} /> },
              { num: 2, title: "Add Your Products", desc: "Upload your catalog or import from Instagram. Set prices, add photos, manage variants and stock — all from your dashboard.", icon: <Package size={28} /> },
              { num: 3, title: "Start Selling 24/7", desc: "AI handles inquiries, shows products, takes orders, and sends payment links — even while you sleep. See everything in real-time.", icon: <Zap size={28} /> },
            ].map((step, i) => (
              <motion.div
                key={i}
                className="step-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
              >
                <div className="step-number-wrap">
                  <motion.div
                    className="step-number-ring"
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: i * 0.2 }}
                  >
                    <div className="step-number">{step.num}</div>
                  </motion.div>
                  <div className="step-number-icon">{step.icon}</div>
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="section" id="pricing">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
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
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="pricing-toggle">
              <span className={!isAnnual ? "active" : ""}>{t("pricing_monthly")}</span>
              <div className={`pricing-switch ${isAnnual ? "annual" : ""}`} onClick={() => setIsAnnual(!isAnnual)} id="pricing-toggle" />
              <span className={isAnnual ? "active" : ""}>{t("pricing_annual")}</span>
              {isAnnual && <span className="pricing-save">Save 20%</span>}
            </div>
          </ScrollReveal>

          <div className="pricing-grid">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                <TiltCard className={`glass-card pricing-card ${plan.featured ? "featured" : ""}`}>
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="section" id="comparison" style={{ paddingTop: 0 }}>
        <div className="section-inner">
          <ScrollReveal>
            <div style={{ overflowX: "auto" }}>
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
                    { category: "Scale & Reach" },
                    { label: "Connected Channels", starter: "1", pro: "2", biz: "3" },
                    { label: "Products", starter: "25", pro: "Unlimited", biz: "Unlimited" },
                    { label: "Conversations / Mo", starter: "100", pro: "1,000", biz: "Unlimited" },
                    { label: "Broadcast Campaigns", starter: false, pro: "5/mo", biz: "Unlimited" },
                    { category: "Team & Support" },
                    { label: "Team Members", starter: "1", pro: "3", biz: "Unlimited" },
                    { label: "Message History", starter: "30 days", pro: "6 months", biz: "Unlimited" },
                    { label: "Support", starter: "Email", pro: "Priority", biz: "Dedicated" },
                  ].map((row, i) => {
                    if (row.category) {
                      return (
                        <tr key={i}>
                          <td colSpan={4} style={{ padding: "var(--space-md) var(--space-lg)", fontWeight: 700, color: "var(--accent-primary-light)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-glass)" }}>
                            {row.category}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "var(--space-md) var(--space-lg)", color: "var(--text-secondary)" }}>{row.label}</td>
                        {[row.starter, row.pro, row.biz].map((val, j) => (
                          <td key={j} style={{ textAlign: "center", padding: "var(--space-md) var(--space-lg)" }}>
                            {val === true ? <Check size={16} style={{ color: "var(--accent-green)", margin: "0 auto" }} /> :
                             val === false ? <X size={16} style={{ color: "var(--text-tertiary)", margin: "0 auto", opacity: 0.4 }} /> :
                             <span style={{ color: "var(--text-secondary)" }}>{val}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="section testimonials" id="testimonials">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
              <span className="badge badge-primary" style={{ marginBottom: 16 }}>
                <Star size={12} />
                Testimonials
              </span>
              <h2>Loved by <span className="text-gradient-static">sellers</span> everywhere</h2>
            </div>
          </ScrollReveal>

          <div className="testimonials-grid">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <div className="glass-card testimonial-card">
                  <div className="testimonial-stars">
                    {[...Array(5)].map((_, j) => <Star key={j} size={14} fill="currentColor" />)}
                  </div>
                  <p className="testimonial-text">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="testimonial-author">
                    <div className="testimonial-avatar">{testimonial.initials}</div>
                    <div className="testimonial-info">
                      <h4>{testimonial.name}</h4>
                      <p>{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" id="faq">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-header">
              <span className="badge badge-primary" style={{ marginBottom: 16 }}>
                <Shield size={12} />
                FAQ
              </span>
              <h2>Frequently Asked <span className="text-gradient-static">Questions</span></h2>
            </div>
          </ScrollReveal>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                className={`faq-item ${openFaq === i ? "open" : ""}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <span className="faq-icon"><Plus size={16} /></span>
                </button>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="section cta-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="cta-box">
              <div className="cta-box-glow" />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2>Ready to automate your sales?</h2>
                <p>Start your 14-day free trial. No credit card required.</p>
                <div className="cta-form">
                  <input className="cta-input" type="email" placeholder="Enter your email" />
                  <button className="btn btn-primary btn-lg" onClick={() => router.push("/signup")}>
                    Get Started <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "var(--font-size-xl)", fontWeight: 800 }}>
                <img src="/logo.png" alt="Sellora" style={{ width: 32, height: 32, borderRadius: 8 }} />
                Sell<span className="text-gradient-static">ora</span>
              </div>
              <p>Automate your WhatsApp, Instagram & Facebook sales with AI. Never miss a message, never lose a customer.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Sellora. All rights reserved.</p>
            <div className="footer-social">
              <a href="#" aria-label="Facebook"><MessageCircle size={16} /></a>
              <a href="#" aria-label="Instagram"><ShoppingBag size={16} /></a>
              <a href="#" aria-label="Twitter"><Globe size={16} /></a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
