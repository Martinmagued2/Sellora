"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag, MessageSquare, Users, Package, CreditCard, Truck,
  BarChart3, Zap, Settings, Bell, Calendar, TrendingUp, CheckCircle2,
  Check, Sparkles, ArrowRight, ChevronRight, Star, AlertCircle, Home,
  Filter, Plus, Search, ShieldCheck, RefreshCw, FileText, Layers
} from "lucide-react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const DASH_DICT = {
  en: {
    navOverview: "Overview",
    navOrders: "Orders",
    navConv: "Conversations",
    navCust: "Customers",
    navProd: "Products",
    navPay: "Payments",
    navShip: "Shipping",
    navAnal: "Analytics",
    navAuto: "Automations",
    navSet: "Settings",
    kpiRevLabel: "Revenue Today",
    kpiOrdLabel: "Orders",
    kpiConvLabel: "Conversations",
    kpiConvSub: "96% Automated",
    kpiRateLabel: "Conversion Rate",
    actTitle: "Recent Activity",
    viewAll: "View all",
    act1: "Instagram order #1058 confirmed",
    act2: "Payment received via Paymob",
    act3: "Order #1057 created",
    act4: "Courier booked (Bosta)",
    act5: "Customer notified on WhatsApp",
    chanTitle: "Sales Channels",
    copilotTitle: "Sellora Copilot",
    c1: "Customer asked about size & price",
    c2: "Inventory reserved",
    c3: "Paymob payment link generated",
    c4: "WhatsApp reply sent",
    c5: "Courier scheduled",
    cDone: "✦ Completed",
    cFooter: "All tasks completed automatically",
    storeName: "Smouha Store",
    storePlatform: "Shopify",
    payTitle: "Payments",
    payRate: "Success Rate",
    invTitle: "Inventory Alerts",
    inv1: "Nike Air Max 42",
    inv2: "Adidas Samba 41",
    invLeft: "left",
    csatTitle: "Customer Satisfaction",
    csatReviews: "From 248 reviews",
    csatLift: "↑ 0.3 vs yesterday",
    currency: "EGP",
  },
  ar: {
    navOverview: "نظرة عامة",
    navOrders: "الأوردرات",
    navConv: "المحادثات",
    navCust: "العملاء",
    navProd: "المنتجات",
    navPay: "المدفوعات",
    navShip: "الشحن والتوصيل",
    navAnal: "التحليلات",
    navAuto: "الأتمتة الذاتية",
    navSet: "الإعدادات",
    kpiRevLabel: "إيرادات اليوم",
    kpiOrdLabel: "الأوردرات",
    kpiConvLabel: "المحادثات",
    kpiConvSub: "96% أتمتة ذاتية",
    kpiRateLabel: "نسبة التحويل",
    actTitle: "النشاط المباشر",
    viewAll: "عرض الكل",
    act1: "تأكيد أوردر إنستجرام #1084",
    act2: "تم استلام الدفع عبر Paymob",
    act3: "تم إنشاء أوردر #1057",
    act4: "تم حجز مندوب الشحن (بوسطة)",
    act5: "تم إرسال إشعار العميل واتساب",
    chanTitle: "قنوات المبيعات",
    copilotTitle: "Sellora Copilot",
    c1: "استفسار العميل عن المقاس والسعر",
    c2: "تم حجز المخزون أوتوماتيكياً",
    c3: "تم إنشاء رابط دفع Paymob",
    c4: "تم إرسال رد الواتساب",
    c5: "تم جدولة مندوب التوصيل",
    cDone: "✦ تم بنجاح",
    cFooter: "تم إنجاز كافة المهام أوتوماتيكياً دون تدخل",
    storeName: "فرع سموحة",
    storePlatform: "شوبيفاي",
    payTitle: "المدفوعات",
    payRate: "نسبة النجاح",
    invTitle: "تنبيهات المخزون",
    inv1: "Nike Air Max 42",
    inv2: "Adidas Samba 41",
    invLeft: "متبقي",
    csatTitle: "رضا العملاء",
    csatReviews: "من 248 تقييم حقيقي",
    csatLift: "↑ 0.3 مقارنة بالأمس",
    currency: "ج.م",
  },
  fr: {
    navOverview: "Aperçu",
    navOrders: "Commandes",
    navConv: "Conversations",
    navCust: "Clients",
    navProd: "Produits",
    navPay: "Paiements",
    navShip: "Expéditions",
    navAnal: "Analytiques",
    navAuto: "Automatisations",
    navSet: "Paramètres",
    kpiRevLabel: "Revenus du Jour",
    kpiOrdLabel: "Commandes",
    kpiConvLabel: "Conversations",
    kpiConvSub: "96% Automatisé",
    kpiRateLabel: "Taux de Conversion",
    actTitle: "Activité Récente",
    viewAll: "Voir tout",
    act1: "Commande Instagram #1058 confirmée",
    act2: "Paiement reçu via Paymob",
    act3: "Commande #1057 créée",
    act4: "Livreur réservé (Bosta)",
    act5: "Client notifié sur WhatsApp",
    chanTitle: "Canaux de Vente",
    copilotTitle: "Sellora Copilot",
    c1: "Demande client taille & prix",
    c2: "Stock réservé en direct",
    c3: "Lien de paiement Paymob généré",
    c4: "Réponse WhatsApp envoyée",
    c5: "Livreur programmé",
    cDone: "✦ Terminé",
    cFooter: "Toutes les tâches exécutées automatiquement",
    storeName: "Boutique Smouha",
    storePlatform: "Shopify",
    payTitle: "Paiements",
    payRate: "Taux de Succès",
    invTitle: "Alertes de Stock",
    inv1: "Nike Air Max 42",
    inv2: "Adidas Samba 41",
    invLeft: "restants",
    csatTitle: "Satisfaction Client",
    csatReviews: "Sur 248 avis",
    csatLift: "↑ 0.3 vs hier",
    currency: "EGP",
  },
};

export default function HeroDashboardMockup() {
  const { lang, dir } = useLanguage();
  const d = DASH_DICT[lang] || DASH_DICT.en;

  const [activeTab, setActiveTab] = useState("Overview");
  const [toastMsg, setToastMsg] = useState(null);
  const [rev, setRev] = useState(42500);
  const [ord, setOrd] = useState(128);
  const [stock1, setStock1] = useState(14);
  const [recentFeed, setRecentFeed] = useState([
    { icon: <MessageSquare size={13} color="#E1306C" />, text: d.act1, val: `650 ${d.currency}`, time: "2m ago", color: "rgba(225, 48, 108, 0.15)" },
    { icon: <CreditCard size={13} color="#25D366" />, text: d.act2, val: `650 ${d.currency}`, time: "5m ago", color: "rgba(37, 211, 102, 0.15)" },
    { icon: <ShoppingBag size={13} color="#96bf48" />, text: d.act3, val: `850 ${d.currency}`, time: "12m ago", color: "rgba(150, 191, 72, 0.15)" },
    { icon: <Truck size={13} color="#fbbf24" />, text: d.act4, val: "Order #1058", time: "18m ago", color: "rgba(251, 191, 36, 0.15)" },
    { icon: <MessageSquare size={13} color="#25D366" />, text: d.act5, val: "✔✔", time: "20m ago", color: "rgba(37, 211, 102, 0.15)" },
  ]);

  const handleNavClick = (tabName) => {
    setActiveTab(tabName);
    setToastMsg(`✔ Workspace Active: Showing ${tabName} module across channels`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Subtle self-running live activity loop
  useEffect(() => {
    const timer = setInterval(() => {
      setRev((p) => p + 650);
      setOrd((p) => p + 1);
      setStock1((p) => (p > 5 ? p - 1 : 14));
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: "Overview", label: d.navOverview, icon: <Home size={14} /> },
    { id: "Orders", label: d.navOrders, icon: <ShoppingBag size={14} />, badge: ord },
    { id: "Conversations", label: d.navConv, icon: <MessageSquare size={14} />, badge: "314" },
    { id: "Customers", label: d.navCust, icon: <Users size={14} /> },
    { id: "Products", label: d.navProd, icon: <Package size={14} /> },
    { id: "Payments", label: d.navPay, icon: <CreditCard size={14} /> },
    { id: "Shipping", label: d.navShip, icon: <Truck size={14} /> },
    { id: "Analytics", label: d.navAnal, icon: <BarChart3 size={14} /> },
    { id: "Automations", label: d.navAuto, icon: <Zap size={14} /> },
    { id: "Settings", label: d.navSet, icon: <Settings size={14} /> },
  ];

  // Helper to render the appropriate dummy content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case "Orders":
      case d.navOrders:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>📦 Orders Management ({ord} Today)</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600 }}>Filter: All Active</span>
                <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>+ Create Order</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10.5px" }}>
              {[
                { id: "#1084", cust: "Omar Khaled", val: `650 ${d.currency}`, pay: "InstaPay (Paymob)", status: "✔ Confirmed", stColor: "#10b981", time: "2m ago" },
                { id: "#1085", cust: "Sara Ahmed", val: `1,200 ${d.currency}`, pay: "InstaPay", status: "🚚 Shipped (Bosta)", stColor: "#818cf8", time: "14m ago" },
                { id: "#1086", cust: "Karim Ali", val: `450 ${d.currency}`, pay: "Cash on Delivery", status: "⏳ Preparing", stColor: "#f59e0b", time: "25m ago" },
                { id: "#1087", cust: "Mona Hassan", val: `850 ${d.currency}`, pay: "FawryPay", status: "✔ Delivered", stColor: "#10b981", time: "1h ago" },
                { id: "#1088", cust: "Youssef Nabil", val: `2,400 ${d.currency}`, pay: "Visa / Mastercard", status: "✔ Confirmed", stColor: "#10b981", time: "2h ago" },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1.2fr 1fr 0.8fr", gap: "6px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", direction: dir }}>
                  <strong style={{ color: "#fff" }}>{row.id}</strong>
                  <span style={{ color: "#e2e8f0" }}>{row.cust}</span>
                  <span style={{ fontWeight: 700, color: "#fff" }}>{row.val}</span>
                  <span style={{ color: "#94a3b8" }}>{row.pay}</span>
                  <span style={{ color: row.stColor, fontWeight: 700 }}>{row.status}</span>
                  <span style={{ color: "#64748b", textAlign: dir === "rtl" ? "left" : "right" }}>{row.time}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "Conversations":
      case d.navConv:
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "10px", minHeight: "360px" }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>💬 Unified Social Inbox (314 Threads)</div>
              {[
                { name: "Omar Khaled (WA)", msg: "ممكن أعرف ميعاد التوصيل؟", time: "2m", active: true },
                { name: "Sara Ahmed (IG)", msg: "تم تحويل إنستاباي، دي السكرين", time: "14m", active: false },
                { name: "Karim Ali (FB)", msg: "سعر الكوتشي مقاس 42 كام؟", time: "30m", active: false },
                { name: "Mona Hassan (WA)", msg: "شكراً جداً الأوردر وصل تحفة", time: "1h", active: false },
              ].map((c, i) => (
                <div key={i} style={{ padding: "8px", borderRadius: "6px", background: c.active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)", border: c.active ? "1px solid rgba(99,102,241,0.3)" : "none", cursor: "pointer", direction: dir }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px", color: "#fff" }}><span>{c.name}</span><span style={{ fontSize: "9px", color: "#818cf8" }}>{c.time}</span></div>
                  <div style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.msg}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between", direction: dir }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "8px" }}>
                <strong style={{ fontSize: "12px", color: "#fff" }}>Omar Khaled • WhatsApp VIP</strong>
                <div style={{ fontSize: "9.5px", color: "#34d399" }}>● AI Auto-Pilot Active • Order #1084 Linked</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "10.5px" }}>
                <div style={{ background: "#056162", color: "#fff", padding: "8px 10px", borderRadius: "8px", alignSelf: dir === "rtl" ? "flex-start" : "flex-end", maxWidth: "80%" }}>
                  ممكن أعرف ميعاد التوصيل لفرع الإسكندرية؟
                </div>
                <div style={{ background: "#1f2937", color: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.3)", alignSelf: dir === "rtl" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                  <span style={{ fontSize: "9px", color: "#818cf8", fontWeight: 700, display: "block" }}>⚡ SELLORA AI INSTANT REPLY</span>
                  أهلاً أستاذ عمر! 📦 كشفت على أوردر #1084 في نظام بوسطة: شحنتك مع المندوب وفي طريقها للتسليم اليوم قبل الساعة 5 مساءً. رقم المندوب: 01098827162.
                </div>
              </div>
              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "9.5px", color: "#64748b", textAlign: "center" }}>
                🔒 Verified Meta Cloud API • Zero Human Delay
              </div>
            </div>
          </div>
        );

      case "Customers":
      case d.navCust:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>👥 Customer CRM &amp; Segments (2,450 Total)</span>
              <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>VIP Buyers: 312 Active</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10.5px" }}>
              {[
                { name: "Omar Khaled", phone: "+20 109 452 811", orders: "3 Orders", spent: `1,950 ${d.currency}`, loc: "Alexandria", tag: "🌟 VIP Buyer", tColor: "#fbbf24" },
                { name: "Sara Ahmed", phone: "+20 112 341 990", orders: "5 Orders", spent: `4,200 ${d.currency}`, loc: "Cairo (Nasr City)", tag: "🌟 VIP Buyer", tColor: "#fbbf24" },
                { name: "Karim Ali", phone: "+20 100 882 119", orders: "1 Order", spent: `450 ${d.currency}`, loc: "Giza", tag: "🟢 Regular", tColor: "#34d399" },
                { name: "Mona Hassan", phone: "+20 122 991 440", orders: "2 Orders", spent: `850 ${d.currency}`, loc: "Mansoura", tag: "🟢 Regular", tColor: "#34d399" },
                { name: "Youssef Nabil", phone: "+20 111 552 331", orders: "4 Orders", spent: `2,400 ${d.currency}`, loc: "Cairo (Maadi)", tag: "🌟 VIP Buyer", tColor: "#fbbf24" },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr 1fr", gap: "6px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", direction: dir }}>
                  <strong style={{ color: "#fff" }}>{row.name}</strong>
                  <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{row.phone}</span>
                  <span style={{ color: "#e2e8f0" }}>{row.orders}</span>
                  <span style={{ fontWeight: 700, color: "#fff" }}>{row.spent}</span>
                  <span style={{ color: "#cbd5e1" }}>{row.loc}</span>
                  <span style={{ color: row.tColor, fontWeight: 700 }}>{row.tag}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "Products":
      case d.navProd:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>🛍️ Shopify Storefront Catalog (248 Synced)</span>
              <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>⚡ Real-time inventory locking</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[
                { name: "Nike Air Max 42", price: `650 ${d.currency}`, sku: "SKU-NK-42", stock: `${stock1} left`, sColor: "#ef4444" },
                { name: "Adidas Samba 41", price: `1,200 ${d.currency}`, sku: "SKU-AD-41", stock: "8 left", sColor: "#f59e0b" },
                { name: "Linen Summer Skirt", price: `850 ${d.currency}`, sku: "SKU-LN-01", stock: "22 left", sColor: "#10b981" },
                { name: "Black Leather Bag", price: `450 ${d.currency}`, sku: "SKU-BG-02", stock: "19 left", sColor: "#10b981" },
                { name: "Cotton Casual Shirt", price: `350 ${d.currency}`, sku: "SKU-SH-05", stock: "31 left", sColor: "#10b981" },
                { name: "Running Sport Socks", price: `150 ${d.currency}`, sku: "SKU-SC-09", stock: "45 left", sColor: "#10b981" },
              ].map((p, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "6px", direction: dir }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "11px", color: "#fff" }}>{p.name}</strong>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>{p.sku}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 900, color: "#fff" }}>{p.price}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: p.sColor }}>● {p.stock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "Payments":
      case d.navPay:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>💳 Payment Gateways &amp; Invoicing</span>
              <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>Success Rate: 96% ↑ 8%</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {[
                { name: "Paymob Direct Webhook", type: "Visa / Mastercard / Meeza", status: "✔ Active & Verified", vol: `28,400 ${d.currency} processed` },
                { name: "InstaPay Egypt Auto-Sync", type: "Instant Banking Webhook", status: "✔ Active & Verified", vol: `14,100 ${d.currency} processed` },
                { name: "Fawry Digital Invoicing", type: "FawryPay Kiosk Codes", status: "✔ Active & Verified", vol: `6,200 ${d.currency} processed` },
                { name: "Vodafone Cash / Mobile Wallets", type: "Electronic Wallets API", status: "✔ Active & Verified", vol: `3,800 ${d.currency} processed` },
              ].map((gw, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", direction: dir }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "12px", color: "#fff" }}>{gw.name}</strong>
                    <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700 }}>{gw.status}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>{gw.type}</div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#818cf8", marginTop: "2px" }}>{gw.vol}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "Shipping":
      case d.navShip:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>🚚 Bosta &amp; Mylerz Live Dispatch (14 Out Today)</span>
              <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>On-time Rate: 98.4%</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10.5px" }}>
              {[
                { trk: "TRK-8812", ord: "Order #1084", loc: "Alexandria (Smouha)", cur: "Mahmoud A.", status: "🚚 Out for Delivery", stColor: "#10b981", time: "10m ago" },
                { trk: "TRK-8813", ord: "Order #1085", loc: "Cairo (Nasr City)", cur: "Khaled S.", status: "✔ Delivered (1:45 PM)", stColor: "#818cf8", time: "1h ago" },
                { trk: "TRK-8814", ord: "Order #1086", loc: "Giza (Dokki)", cur: "Bosta Express", status: "⏳ In Transit", stColor: "#f59e0b", time: "2h ago" },
                { trk: "TRK-8815", ord: "Order #1087", loc: "Mansoura", cur: "Mylerz VIP", status: "✔ Delivered", stColor: "#10b981", time: "3h ago" },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.5fr 1fr 1.2fr 0.8fr", gap: "6px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", direction: dir }}>
                  <strong style={{ color: "#fff", fontFamily: "monospace" }}>{row.trk}</strong>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{row.ord}</span>
                  <span style={{ color: "#cbd5e1" }}>{row.loc}</span>
                  <span style={{ color: "#94a3b8" }}>{row.cur}</span>
                  <span style={{ color: row.stColor, fontWeight: 700 }}>{row.status}</span>
                  <span style={{ color: "#64748b", textAlign: dir === "rtl" ? "left" : "right" }}>{row.time}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "Analytics":
      case d.navAnal:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>📈 Live Performance Insights</span>
              <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>Filter: Last 30 Days</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>Total Revenue Processed</div>
                <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff", marginTop: "4px" }}>1,420,500 <span style={{ fontSize: "10px", color: "#818cf8" }}>{d.currency}</span></div>
                <div style={{ fontSize: "9px", color: "#34d399", fontWeight: 700, marginTop: "2px" }}>↑ 34% vs last month</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>AI Response Deflection</div>
                <div style={{ fontSize: "16px", fontWeight: 900, color: "#818cf8", marginTop: "4px" }}>96.4%</div>
                <div style={{ fontSize: "9px", color: "#34d399", fontWeight: 700, marginTop: "2px" }}>0.8s avg reply speed</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>Abandoned Carts Recovered</div>
                <div style={{ fontSize: "16px", fontWeight: 900, color: "#34d399", marginTop: "4px" }}>+84,200 <span style={{ fontSize: "10px", color: "#818cf8" }}>{d.currency}</span></div>
                <div style={{ fontSize: "9px", color: "#cbd5e1", fontWeight: 700, marginTop: "2px" }}>248 carts auto-saved</div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", direction: dir }}>
              <div style={{ fontSize: "11px", color: "#fff", fontWeight: 700 }}>⚡ Daily Revenue Trend (May 12 – May 18)</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "40px" }}>
                {[35, 48, 62, 55, 78, 85, 96].map((val, i) => (
                  <div key={i} style={{ width: "18px", height: `${val}%`, background: i === 6 ? "#10b981" : "#6366f1", borderRadius: "3px" }} />
                ))}
              </div>
            </div>
          </div>
        );

      case "Automations":
      case d.navAuto:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>⚡ Autonomous Workflows (4 Active Rules)</span>
              <span style={{ background: "#10b981", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>+ Create Rule</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10.5px" }}>
              {[
                { num: "Rule 1", title: "Instant Dialect NLP Reply (<1s)", desc: "When customer messages on WhatsApp/IG → AI identifies intent & replies in dialect", status: "● Active (1,420 runs)" },
                { num: "Rule 2", title: "Shopify Inventory Locking", desc: "When customer asks for size/color → Check live Shopify stock & reserve item for 30 mins", status: "● Active (312 runs)" },
                { num: "Rule 3", title: "Paymob & InstaPay Checkout", desc: "When customer selects InstaPay/Fawry → Generate unique checkout link & auto-confirm receipt", status: "● Active (128 runs)" },
                { num: "Rule 4", title: "Bosta Courier Dispatch", desc: "When order status is Paid → Auto-book Bosta courier pickup and send live tracking to customer", status: "● Active (128 runs)" },
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.8fr 2.5fr 1.2fr", gap: "8px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", direction: dir }}>
                  <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "2px 6px", borderRadius: "4px", fontWeight: 700, textAlign: "center" }}>{r.num}</span>
                  <strong style={{ color: "#fff" }}>{r.title}</strong>
                  <span style={{ color: "#94a3b8", fontSize: "9.5px" }}>{r.desc}</span>
                  <span style={{ color: "#34d399", fontWeight: 700, textAlign: dir === "rtl" ? "left" : "right" }}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "Settings":
      case d.navSet:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontWeight: 800, fontSize: "12px", color: "#fff" }}>⚙️ Enterprise Workspace Configuration</span>
              <span style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700 }}>Store ID: #SL-88192</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {[
                { title: "Store Profile & Catalog", val: "Smouha Store • Connected to Shopify Cloud", status: "✔ Verified Sync", color: "#10b981" },
                { title: "Security & Access Control", val: "Server-Side 2FA Enforced • Webhook Replay Protection", status: "🔒 Bank-Grade", color: "#818cf8" },
                { title: "Team Members & RBAC", val: "Martin Magued (Owner/Admin) • 3 Agent Seats Active", status: "👥 Active", color: "#34d399" },
                { title: "Connected Channels & Gateways", val: "WhatsApp Cloud API • Instagram • Paymob Direct Listener", status: "🟢 99.99% Uptime", color: "#10b981" },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", direction: dir }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "12px", color: "#fff" }}>{s.title}</strong>
                    <span style={{ fontSize: "10px", color: s.color, fontWeight: 700 }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        // Overview view (our original desktop grid)
        return (
          <>
            {/* Top 4 KPI Cards Grid */}
            <div className="dash-kpi-grid">
              {/* KPI 1: Revenue */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", position: "relative" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>{d.kpiRevLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>{rev.toLocaleString()} <span style={{ fontSize: "10px", color: "#818cf8" }}>{d.currency}</span></span>
                  <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700 }}>↑ 18%</span>
                </div>
                <svg viewBox="0 0 100 20" style={{ width: "100%", height: "20px", marginTop: "6px", stroke: "#6366f1", fill: "none", strokeWidth: "2" }}>
                  <path d="M0,15 Q25,5 50,12 T100,3" />
                </svg>
              </div>

              {/* KPI 2: Orders */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", position: "relative" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>{d.kpiOrdLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>{ord}</span>
                  <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700 }}>↑ 22%</span>
                </div>
                <svg viewBox="0 0 100 20" style={{ width: "100%", height: "20px", marginTop: "6px", stroke: "#10b981", fill: "none", strokeWidth: "2" }}>
                  <path d="M0,18 Q30,10 60,14 T100,2" />
                </svg>
              </div>

              {/* KPI 3: Conversations */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", position: "relative" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>{d.kpiConvLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>314</span>
                  <span style={{ fontSize: "9.5px", color: "#00d2ff", fontWeight: 700 }}>{d.kpiConvSub}</span>
                </div>
                <svg viewBox="0 0 100 20" style={{ width: "100%", height: "20px", marginTop: "6px", stroke: "#00d2ff", fill: "none", strokeWidth: "2" }}>
                  <path d="M0,16 Q20,12 50,5 T100,8" />
                </svg>
              </div>

              {/* KPI 4: Conversion Rate */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", position: "relative" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>{d.kpiRateLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>28.6%</span>
                  <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700 }}>↑ 12%</span>
                </div>
                <svg viewBox="0 0 100 20" style={{ width: "100%", height: "20px", marginTop: "6px", stroke: "#a855f7", fill: "none", strokeWidth: "2" }}>
                  <path d="M0,14 Q35,16 65,6 T100,4" />
                </svg>
              </div>
            </div>

            {/* Middle Row Grid (3 Panels: Recent Activity, Sales Channels, Copilot) */}
            <div className="dash-mid-grid">
              {/* Panel 1: Recent Activity */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", fontWeight: 700, color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span>{d.actTitle}</span>
                  <span onClick={() => handleNavClick(d.viewAll)} style={{ fontSize: "9.5px", color: "#818cf8", cursor: "pointer" }}>{d.viewAll}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px" }}>
                  {recentFeed.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: "6px", background: idx === 0 ? "rgba(99, 102, 241, 0.08)" : "transparent", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                        <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {item.icon}
                        </div>
                        <div>
                          <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{item.text}</div>
                          <div style={{ fontSize: "8.5px", color: "#64748b" }}>{item.time}</div>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: "10px" }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel 2: Sales Channels */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", fontWeight: 700, color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span>{d.chanTitle}</span>
                  <span onClick={() => handleNavClick(d.viewAll)} style={{ fontSize: "9.5px", color: "#818cf8", cursor: "pointer" }}>{d.viewAll}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "10px" }}>
                  {[
                    { label: "WhatsApp", pct: 45, color: "#25D366" },
                    { label: "Instagram", pct: 30, color: "#E1306C" },
                    { label: "Facebook", pct: 15, color: "#1877F2" },
                    { label: "Telegram", pct: 6, color: "#0088cc" },
                    { label: "Email", pct: 4, color: "#818cf8" },
                  ].map((ch, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                        <span>{ch.label}</span>
                        <span style={{ fontWeight: 700, color: "#fff" }}>{ch.pct}%</span>
                      </div>
                      <div style={{ width: "100%", height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${ch.pct}%`, height: "100%", background: ch.color, borderRadius: "3px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel 3: Sellora Copilot */}
              <div style={{ background: "linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#c7d2fe", display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px", marginBottom: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <Sparkles size={13} color="#818cf8" />
                    <span>{d.copilotTitle}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "9.5px", color: "#e2e8f0" }}>
                    {[d.c1, d.c2, d.c3, d.c4, d.c5].map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "4px", background: "rgba(255,255,255,0.03)", padding: "4px 6px", borderRadius: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                          <Check size={11} color="#34d399" /> <span>{item}</span>
                        </span>
                        <span style={{ fontSize: "8px", color: "#34d399", fontWeight: 700, whiteSpace: "nowrap" }}>{d.cDone}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "9px", color: "#34d399", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span>{d.cFooter}</span>
                  <CheckCircle2 size={13} color="#10b981" />
                </div>
              </div>
            </div>

            {/* Bottom 4 Panels Grid */}
            <div className="dash-bot-grid">
              {/* Panel 1: Store Switcher */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#96bf48", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: "14px" }}>
                    S
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#fff" }}>{d.storeName}</div>
                    <div style={{ fontSize: "9.5px", color: "#64748b" }}>{d.storePlatform}</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#64748b" style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
              </div>

              {/* Panel 2: Payments Success Rate */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div>
                  <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.payTitle}</div>
                  <div style={{ fontSize: "10px", color: "#cbd5e1" }}>{d.payRate}</div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#fff", marginTop: "2px" }}>96% <span style={{ fontSize: "9.5px", color: "#34d399" }}>↑ 8%</span></div>
                </div>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "4px solid #6366f1", borderTopColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }} />
              </div>

              {/* Panel 3: Inventory Alerts */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", fontWeight: 700, color: "#fff", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span>{d.invTitle}</span>
                  <span onClick={() => handleNavClick(d.invTitle)} style={{ fontSize: "9px", color: "#818cf8", cursor: "pointer" }}>{d.viewAll} &gt;</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#cbd5e1", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><ShoppingBag size={10} color="#ef4444" /> {d.inv1}</span>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>14 {d.invLeft} ●</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#cbd5e1", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><ShoppingBag size={10} color="#f59e0b" /> {d.inv2}</span>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>8 {d.invLeft} ●</span>
                </div>
              </div>

              {/* Panel 4: Customer Satisfaction */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "3px" }}>
                <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.csatTitle}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "14px", fontWeight: 900, color: "#fff" }}>4.9 / 5</span>
                  <div style={{ display: "flex", gap: "1px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={10} fill="#fbbf24" color="#fbbf24" />))}
                  </div>
                </div>
                <div style={{ fontSize: "8.5px", color: "#64748b", display: "flex", justifyContent: "space-between", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span>{d.csatReviews}</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{d.csatLift}</span>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div
      className="hero-dash-mockup-wrapper"
      style={{
        width: "100%",
        background: "#0a0b10",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "20px",
        boxShadow: "0 35px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        userSelect: "none",
        direction: dir,
        textAlign: dir === "rtl" ? "right" : "left",
      }}
    >
      {/* Top Window Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "#0e0f16", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
          <Image src="/logo.png" alt="Sellora" width={24} height={24} style={{ borderRadius: 6 }} />
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Sellora</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Bell size={16} color="#94a3b8" />
            <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <Calendar size={12} color="#818cf8" />
            <span>May 18, 2026</span>
            <span>{dir === "rtl" ? "←" : "→"}</span>
          </div>
        </div>
      </div>

      {/* Main Body: Sidebar + Dashboard Content Grid */}
      <div className="dash-body-grid">
        {/* ================= SIDEBAR ================= */}
        <div style={{ background: "#0c0d14", borderRight: dir === "rtl" ? "none" : "1px solid rgba(255, 255, 255, 0.06)", borderLeft: dir === "rtl" ? "1px solid rgba(255, 255, 255, 0.06)" : "none", padding: "12px 8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "#94a3b8" }}>
          {navItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleNavClick(item.label)}
              style={{
                background: activeTab === item.label ? "rgba(99, 102, 241, 0.2)" : "transparent",
                color: activeTab === item.label ? "#fff" : "#94a3b8",
                padding: "8px 10px",
                borderRadius: "8px",
                fontWeight: activeTab === item.label ? 600 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "all 0.2s ease",
                flexDirection: dir === "rtl" ? "row-reverse" : "row",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                {React.cloneElement(item.icon, { color: activeTab === item.label ? "#818cf8" : "#94a3b8" })}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ================= DASHBOARD CONTENT AREA ================= */}
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px", background: "#0e1017", overflowX: "auto" }}>
          {toastMsg && (
            <div style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", padding: "8px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 15px rgba(99,102,241,0.4)", animation: "slide-down 0.2s ease" }}>
              <Sparkles size={14} /> <span>{toastMsg}</span>
            </div>
          )}
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
