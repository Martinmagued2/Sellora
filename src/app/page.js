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
  Calculator,
  Timer,
  DollarSign,
  Smile,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  BarChart2,
  Sparkles,
  Play,
  Phone,
  Headphones,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/* ============================================
   PARTICLE CANVAS COMPONENT
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
    <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
  );
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
          M300,100 C450,50 550,180 520,300 C490,420 380,520 260,500 C140,480 50,380 80,250 C110,120 150,150 300,100 Z
        " />
      </path>
    </svg>
  );
}

/* ============================================
   INTERACTIVE PHONE WITH SCROLL-ZOOM COMPONENT
   ============================================ */
function FloatingPhone() {
  const ref = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (v) => setScrollProgress(v));
    return () => unsubscribe();
  }, [scrollYProgress]);

  const rawProgress = Math.min(Math.max(scrollProgress, 0), 1);
  const zoomProgress = Math.min(rawProgress / 0.5, 1);
  const eased = 1 - Math.pow(1 - zoomProgress, 3);

  const scale = isMobile ? 1 : 0.6 + eased * 0.4;
  const rotateY = isMobile ? 0 : -20 + eased * 20;
  const rotateX = isMobile ? 0 : 8 - eased * 8;
  const translateY = isMobile ? 0 : 80 - eased * 80;
  const parallaxY = isMobile ? 0 : rawProgress * -60;

  const glowIntensity = eased * 0.6;
  const reflectionAngle = -45 + rawProgress * 30;

  return (
    <div ref={ref} className="phone-zoom-wrapper" style={{ perspective: isMobile ? 1000 : 1400 }}>
      <motion.div
        className="phone-zoom-container"
        style={{
          transform: isMobile
            ? undefined
            : `translateY(${translateY + parallaxY}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`,
          transformStyle: "preserve-3d",
          willChange: "transform",
          opacity: isMobile ? undefined : 0.5 + eased * 0.5,
        }}
        initial={{ opacity: 0, scale: isMobile ? 1 : 0.5 }}
        animate={{ opacity: 1, scale: isMobile ? 1 : undefined }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div className={`phone-mockup ${eased >= 1 ? "phone-at-rest" : ""}`}>
          <div
            className="phone-glow"
            style={{
              opacity: glowIntensity,
              boxShadow: `0 0 60px rgba(88,101,242,${0.3 * glowIntensity}), 0 0 120px rgba(0,210,255,${0.15 * glowIntensity})`,
            }}
          />
          <div className="phone-frame">
            <div className="phone-notch">
              <div className="phone-notch-camera" />
            </div>
            <div className="phone-screen">
              <div className="phone-dash-header">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <LayoutDashboard size={10} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 10, color: "#fff" }}>Sellora</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <Bell size={12} style={{ color: "rgba(255,255,255,0.6)" }} />
                    <div style={{ position: "absolute", top: -2, right: -2, width: 5, height: 5, borderRadius: "50%", background: "var(--accent-red)" }} />
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff" }}>S</div>
                </div>
              </div>
              <div className="phone-dash-stats">
                <div className="phone-dash-stat-card">
                  <DollarSign size={9} style={{ color: "var(--accent-green)" }} />
                  <span className="phone-dash-stat-label">Revenue</span>
                  <span className="phone-dash-stat-value">24.5K</span>
                  <span className="phone-dash-stat-change positive">+12%</span>
                </div>
                <div className="phone-dash-stat-card">
                  <ShoppingCart size={9} style={{ color: "var(--accent-secondary)" }} />
                  <span className="phone-dash-stat-label">Orders</span>
                  <span className="phone-dash-stat-value">184</span>
                  <span className="phone-dash-stat-change positive">+8%</span>
                </div>
                <div className="phone-dash-stat-card">
                  <Users size={9} style={{ color: "var(--accent-primary-light)" }} />
                  <span className="phone-dash-stat-label">Users</span>
                  <span className="phone-dash-stat-value">1.2K</span>
                  <span className="phone-dash-stat-change positive">+23%</span>
                </div>
              </div>
              <div className="phone-dash-chart">
                <div className="phone-dash-chart-header">
                  <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Weekly Sales</span>
                  <span style={{ fontSize: 7, color: "var(--accent-green)" }}>+18.2%</span>
                </div>
                <div className="phone-dash-chart-bars">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="phone-dash-chart-bar-wrapper">
                      <div
                        className="phone-dash-chart-bar"
                        style={{
                          height: `${h}%`,
                          background: i === 5 ? "var(--accent-gradient)" : "rgba(88,101,242,0.3)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="phone-dash-orders">
                <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 4, display: "block" }}>Recent Orders</span>
                {[
                  { id: "#1847", name: "Nour A.", amount: "900 EGP", status: "Delivered", color: "var(--accent-green)" },
                  { id: "#1848", name: "Omar H.", amount: "450 EGP", status: "Shipped", color: "var(--accent-secondary)" },
                  { id: "#1849", name: "Sara Y.", amount: "750 EGP", status: "Pending", color: "var(--accent-orange)" },
                ].map((order, i) => (
                  <div key={i} className="phone-dash-order-row">
                    <div className="phone-dash-order-id">{order.id}</div>
                    <div className="phone-dash-order-name">{order.name}</div>
                    <div className="phone-dash-order-amount">{order.amount}</div>
                    <div className="phone-dash-order-status" style={{ color: order.color, background: `${order.color}20` }}>{order.status}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="phone-home-indicator" />
          </div>
          <div
            className="phone-reflection"
            style={{
              background: `linear-gradient(${reflectionAngle}deg, rgba(255,255,255,${0.06 * eased}) 0%, transparent 50%)`,
            }}
          />
          <motion.div className="phone-float-badge" style={{ top: -20, right: -40 }}
            animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <ShoppingCart size={14} /><span>12 Orders</span>
          </motion.div>
          <motion.div className="phone-float-badge" style={{ bottom: 60, left: -50 }}
            animate={{ y: [0, 8, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
            <MessageSquare size={14} /><span>98% Reply Rate</span>
          </motion.div>
          <motion.div className="phone-float-badge" style={{ top: 80, left: -60 }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
            <TrendingUp size={14} /><span>+340% Sales</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ============================================
   ANIMATED COUNTER COMPONENT
   ============================================ */
function AnimatedCounter({ value, duration = 1.5 }) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const isNumeric = !isNaN(numericValue);
  const [displayValue, setDisplayValue] = useState(isNumeric ? 0 : value);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView || !isNumeric) return;
    let start = 0;
    const end = numericValue;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, numericValue, isNumeric, duration]);

  return <span ref={ref}>{isNumeric ? Math.round(displayValue).toLocaleString() : displayValue}</span>;
}

/* ============================================
   TYPEWRITER TEXT COMPONENT
   ============================================ */
function TypewriterText({ texts, speed = 80, pauseBetween = 2000, gradientIndices = [] }) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const currentFull = texts[currentTextIndex];
    let timeout;

    if (!isDeleting && displayText.length < currentFull.length) {
      timeout = setTimeout(() => setDisplayText(currentFull.slice(0, displayText.length + 1)), speed);
    } else if (!isDeleting && displayText.length === currentFull.length) {
      timeout = setTimeout(() => {
        setIsPaused(true);
        setTimeout(() => { setIsPaused(false); setIsDeleting(true); }, pauseBetween);
      }, 0);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), speed / 2);
    } else if (isDeleting && displayText.length === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setCurrentTextIndex((currentTextIndex + 1) % texts.length);
      }, 0);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentTextIndex, texts, speed, pauseBetween, isPaused]);

  return (
    <span>
      {displayText.split('').map((char, i) => (
        <span key={i} className={gradientIndices.includes(currentTextIndex) && i >= 0 ? 'text-gradient-static' : ''}>
          {char}
        </span>
      ))}
      <span className="typewriter-cursor">|</span>
    </span>
  );
}

/* ============================================
   MAGNETIC BUTTON COMPONENT
   ============================================ */
function MagneticButton({ children, className = '', ...props }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) * 0.15;
    const y = (e.clientY - top - height / 2) * 0.15;
    setPosition({ x, y });
  };

  const handleLeave = () => setPosition({ x: 0, y: 0 });

  return (
    <button
      ref={ref}
      className={`magnetic-btn ${className}`}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ============================================
   FLOATING CHAT BUBBLES COMPONENT
   ============================================ */
function FloatingChatBubbles() {
  const [visibleBubbles, setVisibleBubbles] = useState([]);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const bubbles = [
    { message: "Is the black bag in stock?", sender: "Customer", type: "incoming", delay: 500 },
    { message: "Yes! Available in 3 colors 🎨", sender: "Sellora AI", type: "outgoing", delay: 2000 },
    { message: "I'll take 2! 🛒", sender: "Customer", type: "incoming", delay: 3500 },
    { message: "Payment link sent! 💳", sender: "Sellora AI", type: "outgoing", delay: 4500 },
  ];

  useEffect(() => {
    if (!isInView) return;
    const timers = bubbles.map((bubble, i) => {
      return setTimeout(() => {
        setVisibleBubbles(prev => [...prev, i]);
      }, bubble.delay);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bubbles.map((bubble, i) => (
        <div
          key={i}
          className={`hero-chat-bubble ${bubble.type === 'incoming' ? 'incoming-bubble' : 'outgoing-bubble'} chat-bubble-float ${bubble.type}`}
          style={{
            opacity: visibleBubbles.includes(i) ? 1 : 0,
            animationDelay: visibleBubbles.includes(i) ? '0s' : undefined,
            animationPlayState: visibleBubbles.includes(i) ? 'running' : 'paused',
          }}
        >
          <span className="bubble-sender">{bubble.sender}</span>
          {bubble.message}
        </div>
      ))}
    </div>
  );
}

/* ============================================
   CURSOR TRAIL COMPONENT
   ============================================ */
function CursorTrail() {
  const [isMobile, setIsMobile] = useState(false);
  const dotsRef = useRef([]);
  const mousePos = useRef({ x: 0, y: 0 });
  const dotPositions = useRef(Array.from({ length: 6 }, () => ({ x: 0, y: 0 })));
  const rafRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouse = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);

    function animate() {
      const mp = mousePos.current;
      const dp = dotPositions.current;
      const dots = dotsRef.current;

      // First dot follows cursor with spring
      dp[0].x += (mp.x - dp[0].x) * 0.3;
      dp[0].y += (mp.y - dp[0].y) * 0.3;

      // Each subsequent dot follows the previous
      for (let i = 1; i < dp.length; i++) {
        const factor = 0.2 - i * 0.02;
        dp[i].x += (dp[i - 1].x - dp[i].x) * Math.max(factor, 0.08);
        dp[i].y += (dp[i - 1].y - dp[i].y) * Math.max(factor, 0.08);
      }

      // Apply positions to DOM
      for (let i = 0; i < dots.length; i++) {
        if (dots[i]) {
          dots[i].style.transform = `translate(${dp[i].x - 4}px, ${dp[i].y - 4}px)`;
          dots[i].style.opacity = 1 - i * 0.14;
          dots[i].style.width = `${8 - i * 0.8}px`;
          dots[i].style.height = `${8 - i * 0.8}px`;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouse);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile]);

  if (isMobile) return null;

  const colors = [
    'rgba(88, 101, 242, 0.6)',
    'rgba(88, 101, 242, 0.5)',
    'rgba(68, 131, 242, 0.4)',
    'rgba(48, 161, 242, 0.3)',
    'rgba(0, 210, 255, 0.25)',
    'rgba(0, 210, 255, 0.2)',
  ];

  return (
    <>
      {colors.map((color, i) => (
        <div
          key={i}
          ref={el => dotsRef.current[i] = el}
          className="cursor-trail-dot"
          style={{
            background: color,
            opacity: 0,
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 9999,
            borderRadius: '50%',
          }}
        />
      ))}
    </>
  );
}

/* ============================================
   INTERACTIVE FEATURE DEMO
   ============================================ */
function InteractiveFeatureDemo() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showArrow, setShowArrow] = useState(false);

  const responses = {
    'hi': "Hi there! 👋 Welcome to our store. How can I help you today? We have great deals on bags, shirts, and accessories!",
    'hello': "Hello! 😊 I'm Sellora AI. Looking for something specific? I can show you our catalog, check prices, or help you place an order!",
    'price': "Which product are you asking about? 🏷️ Here are our popular items:\n• Black Bag - 450 EGP\n• Blue Shirt - 350 EGP\n• Cotton Tee - 250 EGP",
    'bag': "The Black Premium Bag is 450 EGP 🖤 Available in Black, Brown, and Navy. Want me to send a payment link?",
    'available': "Yes, it's in stock! ✅ We have multiple colors and sizes available. Would you like to order?",
    'order': "Great choice! 🛒 I'll create your order right away. Would you like to pay via Fawry, InstaPay, or Vodafone Cash?",
    'default': "Thanks for your message! 😊 I can help with:\n• Product info & prices\n• Order placement\n• Payment options\n• Delivery tracking\nJust ask me anything!"
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setIsTyping(true);
    setShowArrow(false);
    const lowerInput = input.toLowerCase();
    let matchedResponse = responses.default;
    for (const [key, val] of Object.entries(responses)) {
      if (key !== 'default' && lowerInput.includes(key)) {
        matchedResponse = val;
        break;
      }
    }

    setTimeout(() => {
      setResponse(matchedResponse);
      setIsTyping(false);
      setShowArrow(true);
    }, 800);
  };

  return (
    <div className="feature-demo">
      <div className="feature-demo-header">
        <Sparkles size={14} style={{ color: "var(--accent-primary-light)" }} />
        <span>Try it — type a message</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="feature-demo-input"
          placeholder="e.g. &quot;Is the black bag available?&quot;"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSend}
          style={{ flexShrink: 0, padding: '8px 14px' }}
        >
          <Send size={14} />
        </button>
      </div>
      {(isTyping || response) && (
        <div className="feature-demo-response">
          <span className="ai-label">Sellora AI</span>
          {isTyping ? (
            <span style={{ opacity: 0.6 }}>Typing...</span>
          ) : (
            response.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < response.split('\n').length - 1 && <br />}
              </span>
            ))
          )}
          <div className={`feature-demo-arrow ${showArrow ? 'visible' : ''}`}>
            <Check size={12} /> AI replied instantly
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================
   ROI CALCULATOR COMPONENT
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
    <section className="section roi-calculator-section section-fade-transition dark-bg" id="roi-calculator" ref={ref}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-primary" style={{ marginBottom: 16 }}>
            <Calculator size={12} />
            ROI Calculator
          </span>
          <h2>
            See Your <span className="text-gradient-static">Potential ROI</span>
          </h2>
          <p>Estimate how much time and money Sellora can save you every month.</p>
        </div>

        <motion.div
          className="roi-calculator-card"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="roi-calculator-inner">
            <div className="roi-sliders-col">
              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>How many DMs do you receive per day?</label>
                  <span className="roi-slider-value">{dms}</span>
                </div>
                <input type="range" min={10} max={500} value={dms} onChange={(e) => setDms(Number(e.target.value))} className="roi-slider" />
                <div className="roi-slider-range"><span>10</span><span>500</span></div>
              </div>
              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>Average order value (EGP)</label>
                  <span className="roi-slider-value">{orderValue.toLocaleString()} EGP</span>
                </div>
                <input type="range" min={50} max={5000} step={50} value={orderValue} onChange={(e) => setOrderValue(Number(e.target.value))} className="roi-slider" />
                <div className="roi-slider-range"><span>50</span><span>5,000</span></div>
              </div>
              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>Hours spent replying per day</label>
                  <span className="roi-slider-value">{hours} hrs</span>
                </div>
                <input type="range" min={1} max={12} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="roi-slider" />
                <div className="roi-slider-range"><span>1</span><span>12</span></div>
              </div>
            </div>
            <div className="roi-results-col">
              {results.map((item, i) => (
                <motion.div
                  key={i}
                  className="roi-result-card"
                  initial={{ opacity: 0, x: 30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
                >
                  <div className="roi-result-icon" style={{ background: `${item.color}20`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div className="roi-result-text">
                    <span className="roi-result-label">{item.label}</span>
                    <span className="roi-result-value" style={{ color: item.color }}>
                      {typeof item.value === "number" ? (
                        <>
                          <AnimatedCounter value={item.value} duration={1.2} />{item.suffix}
                        </>
                      ) : item.value}
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
   LIVE DASHBOARD PREVIEW COMPONENT
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
    { name: "Sellora AI", msg: "Yes! The Blue Classic Shirt is available in L. Would you like to order? Price: 450 EGP 🛒", time: "2:34 PM", incoming: false },
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
    <section className="section dashboard-preview-section section-fade-transition" id="dashboard-preview" ref={ref}>
      <div className="section-inner">
        <div className="section-header animate-on-scroll">
          <span className="badge badge-green" style={{ marginBottom: 16 }}>
            <LayoutDashboard size={12} />
            Live Preview
          </span>
          <h2>
            Experience the <span className="text-gradient-static">Dashboard</span>
          </h2>
          <p>See how Sellora helps you manage conversations, orders, and analytics — all in one place.</p>
        </div>

        <motion.div
          className="dashboard-preview-card"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="dashboard-browser-bar">
            <div className="dashboard-browser-dots">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
            </div>
            <div className="dashboard-browser-url">
              <Shield size={12} />
              <span>app.sellora.app/dashboard</span>
            </div>
          </div>
          <div className="dashboard-preview-tabs">
            {tabs.map((tab, i) => (
              <button key={i} className={`dashboard-preview-tab ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}>
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="dashboard-preview-content">
            <AnimatePresence mode="wait">
              {activeTab === 0 && (
                <motion.div key="conversations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`dashboard-chat-msg ${msg.incoming ? "incoming" : "outgoing"}`}>
                      <div className="dashboard-chat-name">{msg.name}</div>
                      <div className="dashboard-chat-bubble">{msg.msg}</div>
                      <div className="dashboard-chat-time">{msg.time}</div>
                    </div>
                  ))}
                </motion.div>
              )}
              {activeTab === 1 && (
                <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                  <table className="dashboard-orders-table">
                    <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
                    <tbody>
                      {orders.map((order, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{order.id}</td>
                          <td>{order.customer}</td>
                          <td>{order.items}</td>
                          <td style={{ fontWeight: 600 }}>{order.total}</td>
                          <td><span className="dashboard-order-status" style={{ background: `${order.statusColor}20`, color: order.statusColor }}>{order.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
              {activeTab === 2 && (
                <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="dashboard-tab-content">
                  <div className="dashboard-analytics-header">
                    <div><div className="dashboard-analytics-label">Weekly Revenue</div><div className="dashboard-analytics-total">12,450 EGP</div></div>
                    <span className="dashboard-analytics-change">+23% vs last week</span>
                  </div>
                  <div className="dashboard-chart">
                    {analyticsData.map((bar, i) => (
                      <div key={i} className="dashboard-chart-bar-wrapper">
                        <motion.div className="dashboard-chart-bar" initial={{ height: 0 }} animate={{ height: `${bar.value}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }} />
                        <span className="dashboard-chart-label">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================
   BRAND MARQUEE COMPONENT
   ============================================ */
function BrandMarquee() {
  const brands = ["Opio", "Town Team", "Ravin", "Cottonil", "Zara Home", "H&M Egypt", "Noon", "Amazon Egypt"];
  const brandColors = ["rgba(108, 92, 231, 0.12)", "rgba(0, 210, 255, 0.12)", "rgba(59, 165, 92, 0.12)", "rgba(248, 165, 50, 0.12)", "rgba(235, 69, 158, 0.12)", "rgba(237, 66, 69, 0.12)", "rgba(108, 92, 231, 0.12)", "rgba(0, 210, 255, 0.12)"];
  const brandTextColors = ["var(--accent-primary-light)", "var(--accent-secondary)", "var(--accent-green)", "var(--accent-orange)", "var(--accent-pink)", "var(--accent-red)", "var(--accent-primary-light)", "var(--accent-secondary)"];
  const countries = ["EGYPT", "SAUDI", "UAE", "INDIA", "BRAZIL", "NIGERIA"];
  const doubledBrands = [...brands, ...brands];
  const doubledCountries = [...countries, ...countries];

  return (
    <section className="social-proof trusted-by-section">
      <p className="trusted-by-title">Trusted by leading brands</p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-left">
          {doubledBrands.map((brand, i) => (
            <span key={i} className="brand-badge" style={{ background: brandColors[i % brandColors.length], color: brandTextColors[i % brandTextColors.length] }}>{brand}</span>
          ))}
        </div>
      </div>
      <p className="trusted-by-title" style={{ marginTop: "var(--space-xl)" }}>Sellers across the Middle East & beyond</p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-right">
          {doubledCountries.map((country, i) => (
            <span key={i} className="social-proof-logo" style={{ margin: "0 var(--space-xl)" }}>{country}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================
   SCROLL REVEAL TEXT COMPONENT
   ============================================ */
function ScrollRevealText({ children, className = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className={`reveal-text ${isInView ? 'revealed' : ''} ${className}`}>
      {typeof children === 'string'
        ? children.split('').map((char, i) => (
            <span key={i} className="reveal-char" style={{ transitionDelay: `${i * 25}ms` }}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))
        : children
      }
    </div>
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
  const [lostRevenue, setLostRevenue] = useState(0);
  const [showMissedStamp, setShowMissedStamp] = useState(false);
  const [heroCounterValue, setHeroCounterValue] = useState(0);
  const [problemMsgsVisible, setProblemMsgsVisible] = useState(0);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const problemRef = useRef(null);
  const heroCounterRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animate on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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

  // Hero counter animation — counts up to 2,500,000 when in view
  const heroCounterInView = useInView(heroCounterRef, { once: true, margin: "-50px" });
  useEffect(() => {
    if (!heroCounterInView) return;
    let start = 0;
    const end = 2500000;
    const duration = 2500;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * end);
      setHeroCounterValue(current);
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [heroCounterInView]);

  // Problem section — lost revenue counter & stamp
  const problemInView = useInView(problemRef, { once: true, margin: "-100px" });
  useEffect(() => {
    if (!problemInView) return;
    // Show messages one by one
    const msgTimers = [0, 600, 1200, 1800, 2400].map((delay, i) =>
      setTimeout(() => setProblemMsgsVisible(i + 1), delay)
    );
    // Show stamp after messages
    const stampTimer = setTimeout(() => setShowMissedStamp(true), 3000);
    // Lost revenue counter
    const revenueTimer = setInterval(() => {
      setLostRevenue(prev => prev + Math.floor(Math.random() * 50 + 20));
    }, 800);
    return () => {
      msgTimers.forEach(clearTimeout);
      clearTimeout(stampTimer);
      clearInterval(revenueTimer);
    };
  }, [problemInView]);

  // How it works timeline — observe steps
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in-view");
        });
      },
      { threshold: 0.3 }
    );
    document.querySelectorAll(".how-timeline-step").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
    { tier: "STARTER", name: "Starter", desc: "Perfect for solo sellers just getting started", price: isAnnual ? 399 : 499, features: ["1 connected channel (WA, IG or FB)", "25 products", "50 AI replies/day (Fast AI)", "100 conversations/mo", "30-day message history", "Basic analytics", "Email support"], cta: "Start Free Trial", featured: false },
    { tier: "MOST POPULAR", name: "Professional", desc: "For growing businesses that need AI power", price: isAnnual ? 999 : 1299, features: ["2 connected channels", "Unlimited products", "500 AI replies/day (Smart AI)", "1,000 conversations/mo", "6-month message history", "Full analytics dashboard", "Webhook integrations", "3 team members", "5 broadcast campaigns/mo", "Priority support"], cta: "Start Free Trial", featured: true },
    { tier: "BUSINESS", name: "Business", desc: "For teams managing multiple brands at scale", price: isAnnual ? 2499 : 2999, features: ["All 3 channels", "Unlimited everything", "Unlimited AI (Premium GPT-4o)", "Unlimited conversations", "Unlimited message history", "Full analytics + CSV export", "Webhook integrations", "Unlimited team members", "Unlimited campaigns", "Dedicated support"], cta: "Contact Sales", featured: false },
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

  const preventNav = (e) => e.preventDefault();

  const problemChatMessages = [
    { text: "Hi, how much is the black bag? 🖤", time: "11:47 PM", type: "incoming" },
    { text: "Hello?", time: "11:52 PM", type: "incoming" },
    { text: "Is anyone there? 😕", time: "12:15 AM", type: "incoming" },
    { text: "Hi! Sorry I was asleep. The black bag is 450 EGP. Are you interested?", time: "8:30 AM", type: "outgoing" },
    { text: "I already bought from someone else 🤷‍♀️", time: "9:15 AM", type: "incoming" },
  ];

  return (
    <>
      <ParticleCanvas />
      <CursorTrail />
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
                  <button className={`lang-option ${lang === "en" ? "active" : ""}`} onClick={() => { setLang("en"); setLangMenuOpen(false); }}>🇬🇧 English</button>
                  <button className={`lang-option ${lang === "ar" ? "active" : ""}`} onClick={() => { setLang("ar"); setLangMenuOpen(false); }}>🇸🇦 العربية</button>
                  <button className={`lang-option ${lang === "fr" ? "active" : ""}`} onClick={() => { setLang("fr"); setLangMenuOpen(false); }}>🇫🇷 Français</button>
                </div>
              )}
            </div>
            <button className="navbar-login" onClick={() => router.push('/login')}>{t("nav_login")}</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')}>
              {t("nav_get_started")} <ArrowRight size={14} />
            </button>
          </div>
          <button className="navbar-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* ===== MOBILE MENU OVERLAY ===== */}
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

      {/* ===== HERO — CREATIVE REDESIGN ===== */}
      <section className="hero-creative" id="hero">
        <MorphBlob color="purple" style={{ top: "-10%", right: "-5%", width: "60vw", maxWidth: 600, opacity: 0.8 }} />
        <MorphBlob color="cyan" style={{ bottom: "-5%", left: "-8%", width: "50vw", maxWidth: 500, opacity: 0.6 }} />
        <div className="bg-glow hero-glow-1" />
        <div className="bg-glow hero-glow-2" />
        <div className="bg-grid" />

        <div className="hero-creative-layout">
          <div className="hero-creative-top">
            {/* Glitch Badge */}
            <div className="glitch-badge">
              <span className="badge badge-primary">
                <Zap size={12} />
                {t("hero_badge")}
              </span>
            </div>

            {/* Typewriter Heading */}
            <h1>
              <TypewriterText
                texts={["Turn your DMs into a 24/7 sales machine", "Automate replies. Close deals. While you sleep.", "Your AI sales agent that never stops selling"]}
                speed={60}
                pauseBetween={3000}
                gradientIndices={[0, 1, 2]}
              />
            </h1>

            <p className="hero-creative-subtitle">
              {t("hero_subtitle")}
            </p>

            {/* Magnetic CTA Buttons */}
            <div className="hero-creative-cta">
              <MagneticButton
                className="btn btn-primary btn-lg"
                onClick={() => router.push('/signup')}
              >
                {t("hero_cta_primary")} <ArrowRight size={18} />
              </MagneticButton>
              <MagneticButton
                className="btn btn-secondary btn-lg"
                onClick={() => router.push('/login')}
              >
                {t("hero_cta_secondary")} <ChevronRight size={18} />
              </MagneticButton>
            </div>

            {/* Animated single counter instead of stats grid */}
            <div className="hero-creative-counter" ref={heroCounterRef}>
              <Zap size={14} style={{ color: "var(--accent-primary-light)" }} />
              <span className="counter-value">{heroCounterValue.toLocaleString()}+</span>
              <span>messages handled</span>
            </div>
          </div>

          {/* Phone + Chat Bubbles composite area */}
          <div className="hero-creative-phone-area">
            <div className="hero-bubbles-left">
              <FloatingChatBubbles />
            </div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <FloatingPhone />
            </div>
            <div className="hero-bubbles-right">
              {/* Right side bubbles appear naturally through the FloatingChatBubbles */}
            </div>
          </div>
        </div>
      </section>

      {/* ===== BRAND MARQUEE ===== */}
      <BrandMarquee />

      {/* ===== PROBLEM — VISUAL REDESIGN ===== */}
      <section className="section problem section-fade-transition dark-bg" id="problem" ref={problemRef}>
        <div className="section-inner">
          <div className="problem-grid">
            <div className="problem-content animate-on-scroll">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span className="badge badge-primary">
                  <AlertTriangle size={12} />
                  The Problem
                </span>
                <div className="problem-bell-shake">
                  <Bell size={20} />
                </div>
              </div>
              <ScrollRevealText>
                <h2>
                  You&apos;re losing sales in your{" "}
                  <span className="text-gradient-static">DMs</span> right now
                </h2>
              </ScrollRevealText>
              <p>
                Every unanswered message is a lost customer. Every delayed reply
                is money left on the table. Here&apos;s what&apos;s happening:
              </p>

              <div className="problem-list">
                <div className="problem-item">
                  <div className="problem-item-icon"><Clock size={18} /></div>
                  <div className="problem-item-text">
                    <h4>Missed messages at night</h4>
                    <p>60% of customers message between 10PM–2AM. You&apos;re asleep, they buy from someone else.</p>
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
              <div className="problem-mockup" style={{ position: 'relative' }}>
                {/* Red pulsing MISSED stamp */}
                {showMissedStamp && (
                  <div className="missed-stamp missed-stamp-pulse">MISSED</div>
                )}
                <div className="problem-chat">
                  {problemChatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`problem-chat-msg ${msg.type}`}
                      style={{
                        opacity: problemMsgsVisible > i ? 1 : 0,
                        transform: problemMsgsVisible > i ? 'translateY(0)' : 'translateY(15px)',
                        transition: `opacity 0.4s ease ${i * 0.1}s, transform 0.4s ease ${i * 0.1}s`,
                      }}
                    >
                      {msg.text}
                      <span className="time">{msg.time}</span>
                    </div>
                  ))}
                </div>
                {/* Lost revenue counter */}
                {problemInView && (
                  <div className="lost-revenue-counter">
                    <DollarSign size={14} />
                    <span>{lostRevenue.toLocaleString()} EGP lost</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES — HERO FEATURE + MASONRY ===== */}
      <section className="section section-fade-transition" id="features">
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Hero Feature — AI Auto-Replies with interactive demo */}
            <motion.div
              className="glass-card feature-hero-card animate-on-scroll"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="feature-hero-left">
                <div className="feature-icon purple" style={{ width: 64, height: 64 }}>
                  <Bot size={32} />
                </div>
                <h3>
                  AI Auto-Replies that{" "}
                  <span className="text-gradient-static">actually sell</span>
                </h3>
                <p>
                  Not a dumb chatbot — an AI sales agent that understands your products,
                  answers in Arabic & English, and closes deals at 3 AM. Try it below 👇
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  {["Arabic + English", "0.3s response", "24/7 uptime"].map((tag, i) => (
                    <span key={i} style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
              <InteractiveFeatureDemo />
            </motion.div>

            {/* Masonry layout for other 5 features */}
            <div className="feature-masonry">
              {features.slice(1).map((feature, i) => (
                <motion.div
                  key={i}
                  className="glass-card feature-card animate-on-scroll"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className={`feature-icon ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== LIVE DASHBOARD PREVIEW ===== */}
      <LiveDashboardPreview />

      {/* ===== HOW IT WORKS — HORIZONTAL SCROLLING TIMELINE ===== */}
      <section className="section how-it-works section-fade-transition dark-bg" id="how-it-works">
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

          <div className="how-timeline-container">
            <div className="how-timeline">
              {[
                {
                  num: "1",
                  title: "Connect WhatsApp",
                  desc: "Link your WhatsApp Business number in 2 clicks. We handle all the technical setup — API, webhooks, verification.",
                  mockup: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <MessageSquare size={12} style={{ color: "var(--accent-green)" }} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>WhatsApp Connected ✓</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <Globe size={12} style={{ color: "var(--accent-secondary)" }} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>Instagram Connected ✓</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-glass)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <MessageCircle size={12} style={{ color: "var(--accent-primary-light)" }} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>Facebook Connected ✓</span>
                      </div>
                    </div>
                  ),
                },
                {
                  num: "2",
                  title: "Add Your Products",
                  desc: "Upload your catalog or import from Instagram. Set prices, add photos, manage variants and stock — all from your dashboard.",
                  mockup: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { name: "Black Bag", price: "450 EGP", stock: "23 in stock" },
                        { name: "Blue Shirt", price: "350 EGP", stock: "45 in stock" },
                        { name: "Cotton Tee", price: "250 EGP", stock: "12 in stock" },
                      ].map((item, j) => (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--bg-glass)', borderRadius: 4, border: '1px solid var(--border-subtle)', fontSize: 9 }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ color: "var(--accent-green)", fontSize: 8 }}>{item.price}</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  num: "3",
                  title: "Start Selling 24/7",
                  desc: "AI handles inquiries, shows products, takes orders, and sends payment links — even while you sleep. See everything in real-time.",
                  mockup: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ padding: '5px 8px', background: 'rgba(0,230,118,0.08)', borderRadius: 4, border: '1px solid rgba(0,230,118,0.15)', fontSize: 9 }}>
                        <span style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: 8 }}>AI REPLY</span>
                        <div style={{ marginTop: 2 }}>Yes! Available in 3 colors 🎨 Want to order?</div>
                      </div>
                      <div style={{ padding: '5px 8px', background: 'rgba(0,230,118,0.08)', borderRadius: 4, border: '1px solid rgba(0,230,118,0.15)', fontSize: 9 }}>
                        <span style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: 8 }}>PAYMENT</span>
                        <div style={{ marginTop: 2 }}>Payment link sent! 💳 900 EGP</div>
                      </div>
                      <div style={{ padding: '5px 8px', background: 'rgba(108,92,231,0.08)', borderRadius: 4, border: '1px solid rgba(108,92,231,0.15)', fontSize: 9 }}>
                        <span style={{ color: "var(--accent-primary-light)", fontWeight: 700, fontSize: 8 }}>ORDER #1850</span>
                        <div style={{ marginTop: 2 }}>✓ Confirmed & processing</div>
                      </div>
                    </div>
                  ),
                },
              ].map((step, i) => (
                <div key={i} className="how-timeline-step">
                  <div className="step-number">{step.num}</div>
                  {i < 2 && (
                    <div className="step-connector">
                      <div className="step-connector-line" />
                    </div>
                  )}
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                    <div className="step-mockup">{step.mockup}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ChevronRight size={14} />
            Scroll to explore
          </div>
        </div>
      </section>

      {/* ===== ROI CALCULATOR ===== */}
      <ROICalculator />

      {/* ===== PRICING ===== */}
      <section className="section section-fade-transition" id="pricing">
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

          {/* Social proof line */}
          <div className="pricing-social-proof animate-on-scroll">
            <div className="proof-icon">
              <Users size={10} />
            </div>
            <span>Most entrepreneurs choose <strong style={{ color: "var(--text-primary)" }}>Professional</strong></span>
            <div style={{ display: 'flex', marginLeft: 8 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent-gradient)',
                  border: '2px solid var(--bg-primary)',
                  marginLeft: i > 0 ? -6 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: 800, color: '#fff',
                }}>
                  {['N','O','S','M','K'][i]}
                </div>
              ))}
            </div>
          </div>

          <div className="pricing-toggle animate-on-scroll">
            <span className={!isAnnual ? "active" : ""}>{t("pricing_monthly")}</span>
            <div className={`pricing-switch ${isAnnual ? "annual" : ""}`} onClick={() => setIsAnnual(!isAnnual)} id="pricing-toggle" />
            <span className={isAnnual ? "active" : ""}>{t("pricing_annual")}</span>
            {isAnnual && <span className="pricing-save">Save 20%</span>}
          </div>

          <div className="pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div key={i} className={`glass-card pricing-card animate-on-scroll ${plan.featured ? "featured" : ""}`}>
                {plan.featured && (
                  <div className="pricing-popular">
                    <span className="badge badge-primary">Most Popular</span>
                  </div>
                )}
                <div className="pricing-tier">{plan.tier}</div>
                <div className="pricing-name">{plan.name}</div>
                <div className="pricing-desc">{plan.desc}</div>
                <div className="pricing-price">
                  <span className="pricing-currency" style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, alignSelf: "baseline", marginBottom: 2 }}>{lang === "en" ? "" : ""}</span>
                  <span className="pricing-amount pricing-amount-animated">
                    <AnimatedCounter value={plan.price} duration={1.5} />
                  </span>
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
                <MagneticButton
                  className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"} btn-lg`}
                  style={{ width: '100%' }}
                  id={`pricing-cta-${i}`}
                  onClick={() => router.push('/signup')}
                >
                  {plan.cta}
                </MagneticButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="section section-fade-transition dark-bg" id="comparison" style={{ paddingTop: 0 }}>
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
                    <th key={p.name} style={{ textAlign: "center", padding: "var(--space-md) var(--space-lg)", fontWeight: 700, color: p.color, borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { category: "🤖 AI & Automation" },
                  { label: "AI Model", starter: "Fast (Llama 3)", pro: "Smart (GPT-4o Mini)", biz: "Premium (GPT-4o)" },
                  { label: "AI Replies / Day", starter: "50", pro: "500", biz: "Unlimited" },
                  { label: "AI Simulator Tests / Day", starter: "10", pro: "50", biz: "Unlimited" },
                  { label: "Custom AI Personality", starter: false, pro: true, biz: true },
                  { category: "📦 Scale & Limits" },
                  { label: "Connected Channels", starter: "1", pro: "2", biz: "3 (All)" },
                  { label: "Products", starter: "25", pro: "Unlimited", biz: "Unlimited" },
                  { label: "Conversations / Month", starter: "100", pro: "1,000", biz: "Unlimited" },
                  { label: "Customers", starter: "200", pro: "Unlimited", biz: "Unlimited" },
                  { category: "💾 Data & History" },
                  { label: "Message History", starter: "30 days", pro: "6 months", biz: "Unlimited" },
                  { label: "Analytics", starter: "Basic", pro: "Full", biz: "Full + CSV Export" },
                  { category: "🔌 Integrations & Team" },
                  { label: "Webhook Integrations", starter: false, pro: true, biz: true },
                  { label: "Broadcast Campaigns / Mo", starter: "None", pro: "5", biz: "Unlimited" },
                  { label: "Team Members", starter: "1 (Owner)", pro: "3", biz: "Unlimited" },
                  { category: "🛠️ Support" },
                  { label: "Support", starter: "Email", pro: "Priority Email", biz: "Dedicated" },
                  { label: "14-Day Free Trial", starter: true, pro: true, biz: true },
                ].map((row, i) => {
                  if (row.category) {
                    return (
                      <tr key={i}>
                        <td colSpan={4} style={{ padding: "var(--space-lg) var(--space-lg) var(--space-sm)", fontWeight: 700, fontSize: "var(--font-size-xs)", letterSpacing: "0.08em", color: "var(--text-tertiary)", textTransform: "uppercase", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-glass)" }}>{row.category}</td>
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
      <section className="section testimonials section-fade-transition" id="testimonials">
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
              <motion.div
                key={i}
                className="glass-card testimonial-card animate-on-scroll"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section section-fade-transition" id="faq">
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
      <section className="section cta-section section-fade-transition" id="cta">
        <div className="section-inner">
          <div className="cta-box animate-on-scroll">
            <div className="cta-box-glow" />
            <h2>
              {t("cta_title_1")} <span className="text-gradient-static">{t("cta_title_2")}</span>{" "}
              {t("cta_title_3")}
            </h2>
            <p>{t("cta_subtitle")}</p>
            <div className="cta-form">
              <input type="email" className="cta-input" placeholder={t("cta_placeholder")} id="cta-email" />
              <MagneticButton className="btn btn-primary" id="cta-submit" onClick={() => router.push('/signup')}>
                {t("cta_button")} <ArrowRight size={16} />
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
    </>
  );
}
