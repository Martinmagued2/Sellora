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
} from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
    <section className="section roi-calculator-section" id="roi-calculator" ref={ref}>
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
            {/* Sliders Column */}
            <div className="roi-sliders-col">
              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>How many DMs do you receive per day?</label>
                  <span className="roi-slider-value">{dms}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  value={dms}
                  onChange={(e) => setDms(Number(e.target.value))}
                  className="roi-slider"
                />
                <div className="roi-slider-range"><span>10</span><span>500</span></div>
              </div>

              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>Average order value (EGP)</label>
                  <span className="roi-slider-value">{orderValue.toLocaleString()} EGP</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={orderValue}
                  onChange={(e) => setOrderValue(Number(e.target.value))}
                  className="roi-slider"
                />
                <div className="roi-slider-range"><span>50</span><span>5,000</span></div>
              </div>

              <div className="roi-slider-group">
                <div className="roi-slider-header">
                  <label>Hours spent replying per day</label>
                  <span className="roi-slider-value">{hours} hrs</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="roi-slider"
                />
                <div className="roi-slider-range"><span>1</span><span>12</span></div>
              </div>
            </div>

            {/* Results Column */}
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
    { label: "Mon", value: 65 },
    { label: "Tue", value: 80 },
    { label: "Wed", value: 45 },
    { label: "Thu", value: 90 },
    { label: "Fri", value: 70 },
    { label: "Sat", value: 95 },
    { label: "Sun", value: 85 },
  ];

  return (
    <section className="section dashboard-preview-section" id="dashboard-preview" ref={ref}>
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
          {/* Browser Chrome */}
          <div className="dashboard-browser-bar">
            <div className="dashboard-browser-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="dashboard-browser-url">
              <Shield size={12} />
              <span>app.sellora.app/dashboard</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="dashboard-preview-tabs">
            {tabs.map((tab, i) => (
              <button
                key={i}
                className={`dashboard-preview-tab ${activeTab === i ? "active" : ""}`}
                onClick={() => setActiveTab(i)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="dashboard-preview-content">
            <AnimatePresence mode="wait">
              {activeTab === 0 && (
                <motion.div
                  key="conversations"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="dashboard-tab-content"
                >
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
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="dashboard-tab-content"
                >
                  <table className="dashboard-orders-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{order.id}</td>
                          <td>{order.customer}</td>
                          <td>{order.items}</td>
                          <td style={{ fontWeight: 600 }}>{order.total}</td>
                          <td>
                            <span className="dashboard-order-status" style={{ background: `${order.statusColor}20`, color: order.statusColor }}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {activeTab === 2 && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="dashboard-tab-content"
                >
                  <div className="dashboard-analytics-header">
                    <div>
                      <div className="dashboard-analytics-label">Weekly Revenue</div>
                      <div className="dashboard-analytics-total">12,450 EGP</div>
                    </div>
                    <span className="dashboard-analytics-change">+23% vs last week</span>
                  </div>
                  <div className="dashboard-chart">
                    {analyticsData.map((bar, i) => (
                      <div key={i} className="dashboard-chart-bar-wrapper">
                        <motion.div
                          className="dashboard-chart-bar"
                          initial={{ height: 0 }}
                          animate={{ height: `${bar.value}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                        />
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
  const brandColors = [
    "rgba(108, 92, 231, 0.12)",
    "rgba(0, 210, 255, 0.12)",
    "rgba(59, 165, 92, 0.12)",
    "rgba(248, 165, 50, 0.12)",
    "rgba(235, 69, 158, 0.12)",
    "rgba(237, 66, 69, 0.12)",
    "rgba(108, 92, 231, 0.12)",
    "rgba(0, 210, 255, 0.12)",
  ];
  const brandTextColors = [
    "var(--accent-primary-light)",
    "var(--accent-secondary)",
    "var(--accent-green)",
    "var(--accent-orange)",
    "var(--accent-pink)",
    "var(--accent-red)",
    "var(--accent-primary-light)",
    "var(--accent-secondary)",
  ];

  const countries = ["EGYPT", "SAUDI", "UAE", "INDIA", "BRAZIL", "NIGERIA"];

  // Double the items for seamless loop
  const doubledBrands = [...brands, ...brands];
  const doubledCountries = [...countries, ...countries];

  return (
    <section className="social-proof trusted-by-section">
      {/* Row 1: Brands */}
      <p className="trusted-by-title">Trusted by leading brands</p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-left">
          {doubledBrands.map((brand, i) => (
            <span
              key={i}
              className="brand-badge"
              style={{ background: brandColors[i % brandColors.length], color: brandTextColors[i % brandTextColors.length] }}
            >
              {brand}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2: Countries (opposite direction) */}
      <p className="trusted-by-title" style={{ marginTop: "var(--space-xl)" }}>
        Sellers across the Middle East & beyond
      </p>
      <div className="brand-marquee-row">
        <div className="brand-marquee-track brand-marquee-track-right">
          {doubledCountries.map((country, i) => (
            <span key={i} className="social-proof-logo" style={{ margin: "0 var(--space-xl)" }}>
              {country}
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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animate on scroll
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

    document.querySelectorAll(".animate-on-scroll").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
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

  // Helper for footer links that don't exist yet
  const preventNav = (e) => e.preventDefault();

  return (
    <>
      {/* ===== NAVBAR ===== */}
      <nav className={`navbar ${isScrolled ? "scrolled" : ""}`} id="navbar">
        <div className="navbar-inner">
          <a href="#" className="navbar-logo">
            <img src="/logo.png" alt="Sellora" className="navbar-logo-img" style={{ width: 32, height: 32, borderRadius: 8 }} />
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
            {/* Theme Toggle */}
            <button
              className="navbar-icon-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Language Switcher */}
            <div className="lang-switcher" style={{ position: "relative" }}>
              <button
                className="navbar-icon-btn"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                title="Change language"
                aria-label="Change language"
              >
                <Globe size={18} />
                <span style={{ fontSize: "var(--font-size-xs)", marginLeft: 4 }}>
                  {lang.toUpperCase()}
                </span>
              </button>
              {langMenuOpen && (
                <div className="lang-dropdown">
                  <button className={`lang-option ${lang === "en" ? "active" : ""}`} onClick={() => { setLang("en"); setLangMenuOpen(false); }}>
                    🇬🇧 English
                  </button>
                  <button className={`lang-option ${lang === "ar" ? "active" : ""}`} onClick={() => { setLang("ar"); setLangMenuOpen(false); }}>
                    🇸🇦 العربية
                  </button>
                  <button className={`lang-option ${lang === "fr" ? "active" : ""}`} onClick={() => { setLang("fr"); setLangMenuOpen(false); }}>
                    🇫🇷 Français
                  </button>
                </div>
              )}
            </div>

            <button className="navbar-login" onClick={() => router.push('/login')}>{t("nav_login")}</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/signup')}>
              {t("nav_get_started")} <ArrowRight size={14} />
            </button>
          </div>

          <button
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
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

      {/* ===== HERO ===== */}
      <section className="hero" id="hero">
        <div className="bg-glow hero-glow-1" />
        <div className="bg-glow hero-glow-2" />
        <div className="bg-grid" />

        {/* Floating elements */}
        <div className="hero-float-elements">
          <div className="hero-float-el">
            <div className="hero-float-icon green">
              <Check size={16} />
            </div>
            <span>Order #1847 confirmed ✓</span>
          </div>
          <div className="hero-float-el">
            <div className="hero-float-icon blue">
              <Bot size={16} />
            </div>
            <span>AI replied in 0.3s</span>
          </div>
          <div className="hero-float-el">
            <div className="hero-float-icon purple">
              <TrendingUp size={16} />
            </div>
            <span>Sales up 340% ↑</span>
          </div>
          <div className="hero-float-el">
            <div className="hero-float-icon orange">
              <CreditCard size={16} />
            </div>
            <span>Payment received 💰</span>
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge badge-primary">
              <Zap size={12} />
              {t("hero_badge")}
            </span>
          </div>

          <h1>
            {t("hero_title_1")} <span className="text-gradient">{t("hero_title_2")}</span> {t("hero_title_3")}{" "}
            <span className="text-gradient">{t("hero_title_4")}</span>
          </h1>

          <p className="hero-subtitle">
            {t("hero_subtitle")}
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" id="hero-cta-primary" onClick={() => router.push('/signup')}>
              {t("hero_cta_primary")} <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary btn-lg" id="hero-cta-demo" onClick={() => router.push('/login')}>
              {t("hero_cta_secondary")} <ChevronRight size={18} />
            </button>
          </div>

          {/* FEATURE 4: Enhanced Hero Stats */}
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static stat-pulse">5,000+</div>
              <div className="hero-stat-label">{t("hero_stat_sellers")}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static stat-pulse">2.5M+</div>
              <div className="hero-stat-label">{t("hero_stat_messages")}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static stat-pulse">3x</div>
              <div className="hero-stat-label">Average Sales Increase</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value text-gradient-static stat-pulse">98%</div>
              <div className="hero-stat-label">{t("hero_stat_uptime")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE 5: TRUSTED BY LOGOS (replaces old Social Proof) ===== */}
      <BrandMarquee />

      {/* ===== PROBLEM ===== */}
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
                  <div className="problem-item-icon">
                    <Clock size={18} />
                  </div>
                  <div className="problem-item-text">
                    <h4>Missed messages at night</h4>
                    <p>
                      60% of customers message between 10PM–2AM. You&apos;re
                      asleep, they buy from someone else.
                    </p>
                  </div>
                </div>
                <div className="problem-item">
                  <div className="problem-item-icon">
                    <Copy size={18} />
                  </div>
                  <div className="problem-item-text">
                    <h4>Copy-pasting prices all day</h4>
                    <p>
                      You spend 3+ hours/day answering &quot;How much is
                      this?&quot; and &quot;Is it available?&quot; manually.
                    </p>
                  </div>
                </div>
                <div className="problem-item">
                  <div className="problem-item-icon">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="problem-item-text">
                    <h4>Lost orders in chat history</h4>
                    <p>
                      No tracking. No system. Orders get mixed up, customers get
                      frustrated, you lose repeat business.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="problem-visual animate-on-scroll">
              <div className="problem-mockup">
                <div className="problem-chat">
                  <div className="problem-chat-msg incoming">
                    Hi, how much is the black bag? 🖤
                    <span className="time">11:47 PM</span>
                  </div>
                  <div className="problem-chat-msg incoming">
                    Hello?
                    <span className="time">11:52 PM</span>
                  </div>
                  <div className="problem-chat-msg incoming">
                    Is anyone there? 😕
                    <span className="time">12:15 AM</span>
                  </div>
                  <div className="problem-chat-msg outgoing">
                    Hi! Sorry I was asleep. The black bag is 450 EGP. Are you
                    interested?
                    <span className="time">8:30 AM</span>
                  </div>
                  <div className="problem-chat-msg incoming">
                    I already bought from someone else 🤷‍♀️
                    <span className="time">9:15 AM</span>
                  </div>
                </div>
              </div>
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
            <p>
              {t("features_subtitle")}
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, i) => (
              <div
                key={i}
                className="glass-card feature-card animate-on-scroll"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`feature-icon ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURE 2: LIVE DASHBOARD PREVIEW (after features) ===== */}
      <LiveDashboardPreview />

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
            <div className="step-card animate-on-scroll">
              <div className="step-number">1</div>
              <h3>Connect WhatsApp</h3>
              <p>
                Link your WhatsApp Business number in 2 clicks. We handle all
                the technical setup — API, webhooks, verification.
              </p>
            </div>
            <div className="step-card animate-on-scroll">
              <div className="step-number">2</div>
              <h3>Add Your Products</h3>
              <p>
                Upload your catalog or import from Instagram. Set prices, add
                photos, manage variants and stock — all from your dashboard.
              </p>
            </div>
            <div className="step-card animate-on-scroll">
              <div className="step-number">3</div>
              <h3>Start Selling 24/7</h3>
              <p>
                AI handles inquiries, shows products, takes orders, and sends
                payment links — even while you sleep. See everything in
                real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE 1: ROI CALCULATOR (before pricing) ===== */}
      <ROICalculator />

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
            <p>
              {t("pricing_subtitle")}
            </p>
          </div>

          <div className="pricing-toggle animate-on-scroll">
            <span className={!isAnnual ? "active" : ""}>{t("pricing_monthly")}</span>
            <div
              className={`pricing-switch ${isAnnual ? "annual" : ""}`}
              onClick={() => setIsAnnual(!isAnnual)}
              id="pricing-toggle"
            />
            <span className={isAnnual ? "active" : ""}>{t("pricing_annual")}</span>
            {isAnnual && <span className="pricing-save">Save 20%</span>}
          </div>

          <div className="pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`glass-card pricing-card animate-on-scroll ${plan.featured ? "featured" : ""
                  }`}
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
                      <div className="pricing-feature-check">
                        <Check size={12} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"
                    } btn-lg`}
                  id={`pricing-cta-${i}`}
                  onClick={() => router.push('/signup')}
                >
                  {plan.cta}
                </button>
              </div>
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
            <h2>
              {t("testimonials_title")}
            </h2>
            <p>
              {t("testimonials_subtitle")}
            </p>
          </div>

          <div className="testimonials-grid">
            {testimonials.map((tItem, i) => (
              <div
                key={i}
                className="glass-card testimonial-card animate-on-scroll"
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
              </div>
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
              <div
                key={i}
                className={`faq-item ${openFaq === i ? "open" : ""
                  }`}
              >
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  id={`faq-${i}`}
                >
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
            <h2>
              {t("cta_title_1")} <span className="text-gradient-static">{t("cta_title_2")}</span>{" "}
              {t("cta_title_3")}
            </h2>
            <p>
              {t("cta_subtitle")}
            </p>
            <div className="cta-form">
              <input
                type="email"
                className="cta-input"
                placeholder={t("cta_placeholder")}
                id="cta-email"
              />
              <button className="btn btn-primary" id="cta-submit" onClick={() => router.push('/signup')}>
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
                <span>
                  Sell
                  <span className="text-gradient-static">ora</span>
                </span>
              </a>
              <p>
                {t("footer_desc")}
              </p>
            </div>

            {/* FEATURE 3: Fixed footer links */}
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

          {/* Added new links row */}
          <div className="footer-extra-links">
            <a href="/help" onClick={preventNav}>Help Center</a>
            <a href="/status" onClick={preventNav}>Status</a>
          </div>

          <div className="footer-bottom">
            <p>{t("footer_copyright")}</p>
            <div className="footer-social">
              <a href="#" aria-label="Twitter">
                <Globe size={16} />
              </a>
              <a href="#" aria-label="LinkedIn">
                <Users size={16} />
              </a>
              <a href="#" aria-label="Instagram">
                <MessageCircle size={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
