"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import CardSwap, { Card } from "./components/CardSwap";
import ScrollCardSwap, { Card as ScrollCard } from "./components/ScrollCardSwap";
import HeroSection from "./components/landing/HeroSection";
import BeforeAfterScrubber from "./components/landing/BeforeAfterScrubber";
import InteractiveSandbox from "./components/landing/InteractiveSandbox";
import ROICalculator from "./components/landing/ROICalculator";
import AutomatedLifecycleTimeline from "./components/landing/AutomatedLifecycleTimeline";
import HonestTrustSection from "./components/landing/HonestTrustSection";

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
/* ============================================
   LIVE DASHBOARD PREVIEW
   ============================================ */
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
   ECOSYSTEM & TECH STACK MARQUEE (Honest Trust)
   ============================================ */
function BrandMarquee() {
  const integrations = [
    "WhatsApp Business API", "Shopify Storefront", "Paymob Direct Webhooks", "InstaPay Egypt", 
    "Fawry Invoicing", "Vodafone Cash", "Strict Data Isolation", "Supabase RLS", 
    "Autonomous Reasoning Engine", "Sub-Second Dialect NLP"
  ];
  const certs = [
    "2FA SERVER ENFORCEMENT", "ENTERPRISE ROW-LEVEL SECURITY", "DIRECT BANKING WEBHOOKS", 
    "SUB-SECOND NLP ROUTING", "REAL-TIME DATA SYNCHRONIZATION", "ZERO HUMAN DELAY"
  ];
  const doubledIntegrations = [...integrations, ...integrations];
  const doubledCerts = [...certs, ...certs];

  return (
    <section className="social-proof trusted-by-section">
      <p className="trusted-by-title">Official E-Commerce Integration Ecosystem</p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-left">
          {doubledIntegrations.map((item, i) => (
            <span key={i} className="brand-badge" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.25)" }}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <p className="trusted-by-title" style={{ marginTop: "var(--space-xl)" }}>Technical Transparency &amp; Security Certifications</p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-right">
          {doubledCerts.map((cert, i) => (
            <span key={i} className="social-proof-logo" style={{ margin: "0 var(--space-xl)", color: "#34d399", fontWeight: 700, fontSize: "11px", letterSpacing: "0.08em" }}>
              ● {cert}
            </span>
          ))}
        </div>
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
    { tier: "STARTER", name: "Starter", desc: "Perfect for solo sellers launching automated social commerce", price: isAnnual ? 799 : 999, features: ["All 5 connected channels (WA, IG, FB, TG, Email)", "1 Shopify store connection", "25 catalog products", "50 automated replies/day (Fast Response Engine)", "100 conversations/mo", "30-day message history", "Basic analytics dashboard", "Email support"], cta: "Start Free Trial", featured: false },
    { tier: "MOST POPULAR", name: "Professional", desc: "For growing e-commerce brands scaling social revenue", price: isAnnual ? 1999 : 2499, features: ["All 5 connected channels (WA, IG, FB, TG, Email)", "3 Shopify store connections", "Unlimited catalog products", "500 automated replies/day (Smart Reasoning Engine)", "1,000 conversations/mo", "6-month message history", "Full analytics dashboard + Webhooks", "3 team seats", "5 broadcast campaigns/mo", "Priority email support"], cta: "Start Free Trial", featured: true },
    { tier: "BUSINESS", name: "Business", desc: "For teams managing multiple stores and high DM volume", price: isAnnual ? 4799 : 5999, features: ["All 5 connected channels (WA, IG, FB, TG, Email)", "Unlimited Shopify stores", "Unlimited catalog products", "Unlimited automated replies (Advanced Multi-Agent Engine)", "Unlimited conversations", "Unlimited message history", "Full analytics + CSV export + Webhooks", "Unlimited team seats", "Unlimited broadcast campaigns", "Dedicated account manager"], cta: "Contact Sales", featured: false },
  ];

  

  const faqs = [
    { q: "Do I need a WhatsApp Business API account?", a: "We help you set everything up! When you sign up, we guide you through connecting your WhatsApp Business number. The process takes about 10 minutes. You'll need a Meta Business account (free) and a dedicated phone number." },
    { q: "Does it work with regular WhatsApp or Instagram?", a: "Sellora works with the WhatsApp Business API, Instagram Business, and Facebook Messenger. We support all three platforms from a single unified dashboard." },
    { q: "Can the AI reply in Arabic?", a: "Absolutely! Our AI is fluent in both Arabic and English, and can switch between languages automatically. It also understands Egyptian dialect, Gulf Arabic, and formal Arabic." },
    { q: "What payment methods are supported?", a: "We support Fawry, InstaPay, Vodafone Cash, Orange Cash for Egypt. For international customers: Stripe, PayPal, and bank transfers." },
    { q: "Can I try it for free?", a: "Yes! Every plan comes with a 14-day free trial — no credit card required." },
    { q: "Is my data secure?", a: "100%. We use bank-level encryption (AES-256), all data is stored in secure cloud infrastructure, and we never share your customer data with third parties." },
  ];

  
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
            <Image src="/logo.png" alt="Sellora" width={32} height={32} className="navbar-logo-img" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span>Sell<span className="text-gradient-static">ora</span></span>
          </a>
          <div className="navbar-links">
            <a href="#features">{t("nav_features")}</a>
            <a href="#automated-lifecycle">{t("nav_how")}</a>
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
            <a href="#automated-lifecycle" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_how")}</a>
            <a href="#pricing" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_pricing")}</a>
            <a href="#faq" className="mobile-menu-link" onClick={() => setMobileMenuOpen(false)}>{t("nav_faq")}</a>
            <div className="mobile-menu-actions">
              <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/login"); }}>{t("nav_login")}</button>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setMobileMenuOpen(false); router.push("/signup"); }}>{t("nav_get_started")} <ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HERO — IMMERSIVE 3D & APPLE GLASS APP ===== */}
      <HeroSection />

      {/* ===== BRAND MARQUEE ===== */}
      <BrandMarquee />
      <SVGWaveDivider />

      {/* ===== AUTOMATED E-COMMERCE LIFECYCLE ===== */}
      <section className="section" id="automated-lifecycle" style={{ background: "var(--bg-secondary)", padding: "60px 0" }}>
        <AutomatedLifecycleTimeline />
      </section>

      {/* ===== THE PROBLEM & INTERACTIVE SCRUBBER ===== */}
      <section className="section problem" id="problem" style={{ position: "relative", overflow: "hidden", padding: "80px 0" }}>
        <div className="section-inner" style={{ textAlign: "center", marginBottom: "40px" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}><span className="dot" /> The Problem vs. Solution</span>
          <h2 className="designer-title" style={{ fontSize: "2.8rem" }}>Why You&apos;re Losing Sales in Your <span style={{ color: "#818cf8" }}>DMs</span> Today</h2>
          <p className="designer-subtitle">Every unanswered message after 10 PM is a lost customer. Drag the slider below to see how Sellora transforms social commerce chaos into automated revenue.</p>
        </div>
        <BeforeAfterScrubber />
      </section>

      {/* ===== 5 CHANNELS SHOWCASE — BOUNCE CARDS ===== */}
      <section className="section" style={{ background: "var(--bg-primary)", overflow: "hidden" }}>
        <div className="section-inner" style={{ textAlign: "center" }}>
          <div className="section-header animate-on-scroll" style={{ marginBottom: 40 }}>
            <span className="badge badge-primary" style={{ marginBottom: 16 }}><MessageSquare size={12} /> Unified Inbox</span>
            <h2 className="section-title-reveal">5 Channels. <span className="text-gradient-static">One Inbox.</span></h2>
            <p>Your customers are everywhere. Sellora&apos;s AI replies on all 5 — instantly, 24/7.</p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300, padding: "20px 0" }}>
            <BounceCards
              images={[
                "/channels/whatsapp.svg",
                "/channels/instagram.svg",
                "/channels/facebook.svg",
                "/channels/telegram.svg",
                "/channels/email.svg",
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

      {/* ===== INTERACTIVE SANDBOX SIMULATOR ===== */}
      <section className="section" id="interactive-sandbox" style={{ background: "var(--bg-primary)", padding: "60px 0" }}>
        <InteractiveSandbox />
      </section>

      {/* ===== AI CAPABILITIES — SCROLL CARD SWAP ===== */}
      <section id="features" style={{ position: "relative", background: "var(--bg-primary)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "80px", paddingBottom: "40px" }}>
          <span className="badge badge-green" style={{ marginBottom: 16 }}><Sparkles size={12} /> Automated Workflows</span>
          <h2 className="section-title-reveal" style={{ fontSize: "2.5rem", marginBottom: "10px" }}>Everything Sellora <span className="text-gradient-static">Automates</span></h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", textAlign: "center" }}>Scroll to explore how Sellora handles every stage of your social e-commerce business autonomously.</p>
        </div>

        <ScrollCardSwap
          width={450}
          height={350}
          cardDistance={50}
          verticalDistance={60}
          skewAmount={5}
          easing="elastic"
        >
          {aiCapabilities.map((cap, i) => (
            <ScrollCard key={i}>
              <div style={{ padding: "40px", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", color: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(168,85,247,0.1))", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
                    {cap.icon}
                  </div>
                  <h3 style={{ fontSize: "24px", fontWeight: 800, margin: 0 }}>{cap.title}</h3>
                </div>
                <p style={{ fontSize: "17px", lineHeight: 1.6, color: "rgba(255,255,255,0.8)", margin: 0 }}>{cap.desc}</p>
                <div style={{ marginTop: "auto", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>Capability {i + 1} of {aiCapabilities.length}</span>
                  <span style={{ fontSize: "40px", fontWeight: 800, color: "rgba(108,92,231,0.1)" }}>0{i + 1}</span>
                </div>
              </div>
            </ScrollCard>
          ))}
        </ScrollCardSwap>
      </section>

      {/* ===== ROI CALCULATOR ===== */}
      <section className="section" id="roi-calculator" style={{ background: "var(--bg-secondary)", padding: "60px 0" }}>
        <ROICalculator />
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

      {/* ===== WHAT EARLY USERS ARE SAYING & BETA TRUST ===== */}
      <HonestTrustSection />

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
                <Image src="/logo.png" alt="Sellora" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
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
              <a href="#features">{t("footer_features")}</a>
              <a href="#pricing">{t("footer_pricing")}</a>
              <a href="#automated-lifecycle">{t("footer_how")}</a>
              <a href="#problem">{t("footer_integrations")}</a>
              <Link href="/api-docs">{t("footer_api")}</Link>
            </div>
            <div className="footer-col">
              <h4>{t("footer_company")}</h4>
              <Link href="/about">{t("footer_about")}</Link>
              <Link href="/blog">{t("footer_blog")}</Link>
              <Link href="/careers">{t("footer_careers")}</Link>
              <a href="mailto:support@sellora.app">{t("footer_contact")}</a>
            </div>
            <div className="footer-col">
              <h4>{t("footer_legal")}</h4>
              <Link href="/privacy">{t("footer_privacy")}</Link>
              <Link href="/terms">{t("footer_terms")}</Link>
              <Link href="/gdpr">{t("footer_gdpr")}</Link>
              <Link href="/security">{t("footer_security")}</Link>
            </div>
          </div>
          <div className="footer-extra-links">
            <Link href="/help">Help Center</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/affiliates">Affiliates</Link>
            <Link href="/status">Status</Link>
          </div>
          <div className="footer-bottom">
            <p>{t("footer_copyright")}</p>
            <div className="footer-social">
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"><Globe size={16} /></a>
              <a href="https://www.linkedin.com/in/martin-magued" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><Users size={16} /></a>
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><MessageCircle size={16} /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp floating button — marketing site lead capture */}
      <a
        href="https://wa.me/201280552535?text=Hi!%20I'm%20interested%20in%20Sellora%20for%20my%20business"
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
