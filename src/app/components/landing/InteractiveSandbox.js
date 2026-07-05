"use client";

import React, { useState } from "react";
import { Send, Bot, Check, Sparkles, MessageSquare, ShieldCheck, Zap, RefreshCw, ShoppingBag, Truck, CreditCard, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const PRESETS_DICT = {
  en: [
    {
      id: "price",
      icon: <ShoppingBag size={16} color="#818cf8" />,
      label: "🛍️ Price & Size Availability Inquiry",
      userQuery: "How much is the linen skirt, what sizes are available, and is there shipping to Nasr City?",
      aiReply: "Welcome! 👗 The linen skirt is 850 EGP and sizes (M, L, XL) are currently in stock. Express shipping to Nasr City arrives within 24 hours for only 50 EGP promo! Which size would you like to reserve?",
      actions: ["⚡ Reserve Size M", "💳 Pay Online (InstaPay/Fawry)", "💬 Chat with Support"],
      backendLogs: [
        { text: "Detected English dialect • Intent: Price & Availability", time: "0.1s" },
        { text: "Queried Shopify Catalog • SKU: SK-LINEN-01 (In Stock)", time: "0.3s" },
        { text: "Calculated Cairo/Nasr City Shipping Zone • Applied Promo -30 EGP", time: "0.5s" },
        { text: "Generated Clickable WhatsApp Quick Replies", time: "0.6s" },
      ],
    },
    {
      id: "tracking",
      icon: <Truck size={16} color="#34d399" />,
      label: "📦 Order Tracking Status #1042",
      userQuery: "I ordered #1042 two days ago and need to check where my package is right now.",
      aiReply: "Hello Mohamed! 📦 Checked order #1042 in our shipping system (Mylerz/Bosta): Your shipment is currently out for delivery with our courier today before 5 PM. Courier contact: 01098827162. Need any schedule adjustment?",
      actions: ["📍 Confirm Receipt Today", "🔄 Reschedule Tomorrow", "📞 Request Courier Call"],
      backendLogs: [
        { text: "Extracted Order ID #1042 • Validated Customer Phone Number", time: "0.2s" },
        { text: "Called Courier API (Mylerz/Bosta) Live Tracking Endpoint", time: "0.4s" },
        { text: "Retrieved Courier Phone & Delivery Time Window", time: "0.6s" },
        { text: "Resolved Ticket #8841 • Support Deflection: 100%", time: "0.7s" },
      ],
    },
    {
      id: "payment",
      icon: <CreditCard size={16} color="#f59e0b" />,
      label: "💳 Instant InstaPay / Fawry Checkout",
      userQuery: "I want to pay with InstaPay or Fawry. What is the method, and do I need to send a screenshot?",
      aiReply: "No worries! You don't need to send screenshots or wait for manual review 🚫✨ Sellora connects directly to your bank! Pay instantly by clicking below via InstaPay or Fawry, and our system auto-confirms your order in 1 second!",
      actions: ["💳 Pay via InstaPay Direct", "🏪 FawryPay Code", "📄 View Official Invoice"],
      backendLogs: [
        { text: "Detected Payment Query • Payment Method: InstaPay / Fawry", time: "0.1s" },
        { text: "Generated Secure Paymob Unique Checkout Token #TX-9921", time: "0.3s" },
        { text: "Attached Auto-Verification Webhook Listener (Zero Human Review)", time: "0.5s" },
        { text: "Ready for Auto-Receipt Issuance", time: "0.6s" },
      ],
    },
  ],
  ar: [
    {
      id: "price",
      icon: <ShoppingBag size={16} color="#818cf8" />,
      label: "🛍️ الاستفسار عن السعر والمقاسات (Egyptian Dialect)",
      userQuery: "كام سعر السيكرت الكتان والمقاسات المتاحة؟ وهل في شحن لمدينة نصر؟",
      aiReply: "أهلاً بك يا فندم! 👗 السيكرت الكتان سعره 850 ج.م والمقاسات المتاحة حالياً (M, L, XL). الشحن لمدينة نصر متاح بيوصل خلال 24 ساعة فقط ومصروفات الشحن 50 ج.م بدل 80 ج.م لفترة محدودة! تحبي تحجزي مقاس إيه؟",
      actions: ["⚡ تأكيد حجز مقاس M", "💳 الدفع أونلاين (InstaPay / فوري)", "💬 التحدث مع خدمة العملاء"],
      backendLogs: [
        { text: "Detected Egyptian Arabic dialect • Intent: Price & Availability", time: "0.1s" },
        { text: "Queried Shopify Catalog • SKU: SK-LINEN-01 (In Stock)", time: "0.3s" },
        { text: "Calculated Cairo/Nasr City Shipping Zone • Applied Promo -30 EGP", time: "0.5s" },
        { text: "Generated Clickable WhatsApp Quick Replies", time: "0.6s" },
      ],
    },
    {
      id: "tracking",
      icon: <Truck size={16} color="#34d399" />,
      label: "📦 تتبع الشحن وحالة الأوردر (Automated Support)",
      userQuery: "أنا طلبت أوردر #1042 من يومين ومحتاج أعرف وصل لغاية فين؟",
      aiReply: "أهلاً بك يا أستاذ محمد! 📦 كشفت على أوردر رقم #1042 في نظام الشحن (بوسطة/Mylerz): الأوردر حالياً مع المندوب وفي طريقه للتسليم اليوم قبل الساعة 5 مساءً. رقم تواصل المندوب: 01098827162. هل محتاج أي تعديل في ميعاد الاستلام؟",
      actions: ["📍 تأكيد استلام اليوم", "🔄 تأجيل لبكرة", "📞 طلب اتصال المندوب"],
      backendLogs: [
        { text: "Extracted Order ID #1042 • Validated Customer Phone Number", time: "0.2s" },
        { text: "Called Courier API (Mylerz/Bosta) Live Tracking Endpoint", time: "0.4s" },
        { text: "Retrieved Courier Phone & Delivery Time Window", time: "0.6s" },
        { text: "Resolved Ticket #8841 • Support Deflection: 100%", time: "0.7s" },
      ],
    },
    {
      id: "payment",
      icon: <CreditCard size={16} color="#f59e0b" />,
      label: "💳 الدفع بـ InstaPay وفوري دون تدخل بشري",
      userQuery: "عايز أدفع بإنستاباي أو فوري، ممكن الطريقة ولازم أبعت سكرين شوت؟",
      aiReply: "ولا يهمك! مش محتاج تبعت سكرين شوت وتستنى حد يراجعها 🚫✨ نظام Sellora رابط مباشر مع بنكك! تقدر تدفع فوراً بالضغط على الرابط أدناه بـ InstaPay أو فوري، والنظام هيأكد دفعك وأوردرك أوتوماتيك في ثانية واحدة ويجيلك الفاتورة الرسمية على الواتساب!",
      actions: ["💳 الدفع عبر InstaPay مباشرة", "🏪 كود فوري باي (FawryPay)", "📄 عرض الفاتورة"],
      backendLogs: [
        { text: "Detected Payment Query • Payment Method: InstaPay / Fawry", time: "0.1s" },
        { text: "Generated Secure Paymob Unique Checkout Token #TX-9921", time: "0.3s" },
        { text: "Attached Auto-Verification Webhook Listener (Zero Human Review)", time: "0.5s" },
        { text: "Ready for Auto-Receipt Issuance", time: "0.6s" },
      ],
    },
  ],
  fr: [
    {
      id: "price",
      icon: <ShoppingBag size={16} color="#818cf8" />,
      label: "🛍️ Demande de Prix & Disponibilité des Tailles",
      userQuery: "Quel est le prix de la jupe en lin, les tailles disponibles, et y a-t-il une livraison au Caire ?",
      aiReply: "Bienvenue ! 👗 La jupe en lin coûte 850 EGP et les tailles (M, L, XL) sont en stock. Livraison express au Caire en 24h pour seulement 50 EGP promo ! Quelle taille souhaitez-vous réserver ?",
      actions: ["⚡ Réserver Taille M", "💳 Payer en Ligne (InstaPay/Fawry)", "💬 Parler au Support"],
      backendLogs: [
        { text: "Langue détectée: Français • Intention: Prix & Stock", time: "0.1s" },
        { text: "Interrogation Catalogue Shopify • SKU: SK-LINEN-01 (En Stock)", time: "0.3s" },
        { text: "Calcul Zone Livraison Le Caire • Promo appliquée -30 EGP", time: "0.5s" },
        { text: "Génération Réponses Rapides WhatsApp", time: "0.6s" },
      ],
    },
    {
      id: "tracking",
      icon: <Truck size={16} color="#34d399" />,
      label: "📦 Suivi de Commande #1042",
      userQuery: "J'ai commandé #1042 il y a deux jours et je souhaite savoir où en est mon colis.",
      aiReply: "Bonjour Mohamed ! 📦 Commande #1042 vérifiée : Votre colis est en cours de livraison avec notre livreur aujourd'hui avant 17h00. Tél livreur : 01098827162. Souhaitez-vous modifier l'heure de livraison ?",
      actions: ["📍 Confirmer Réception", "🔄 Reporter à Demain", "📞 Contacter Livreur"],
      backendLogs: [
        { text: "ID Commande #1042 extrait • Numéro de Téléphone Validé", time: "0.2s" },
        { text: "Appel API Livreur (Mylerz/Bosta) Temps Réel", time: "0.4s" },
        { text: "Récupération Contact Livreur & Créneau Horaire", time: "0.6s" },
        { text: "Ticket #8841 Résolu • Taux de Déflexion: 100%", time: "0.7s" },
      ],
    },
    {
      id: "payment",
      icon: <CreditCard size={16} color="#f59e0b" />,
      label: "💳 Paiement InstaPay / Fawry Instantané",
      userQuery: "Je souhaite payer via InstaPay ou Fawry. Quelle est la méthode et dois-je envoyer une capture ?",
      aiReply: "Ne vous inquiétez pas ! Aucune capture d'écran requise 🚫✨ Sellora est connecté à votre banque ! Payez en 1 clic via le lien ci-dessous et notre système validera votre commande en 1 seconde !",
      actions: ["💳 Payer par InstaPay Direct", "🏪 Code FawryPay", "📄 Voir Facture"],
      backendLogs: [
        { text: "Requête Paiement • Méthode: InstaPay / Fawry", time: "0.1s" },
        { text: "Jeton de Paiement Unique Paymob généré #TX-9921", time: "0.3s" },
        { text: "Webhooks Auto-Vérification attachés (Zéro Humain)", time: "0.5s" },
        { text: "Prêt pour émission facture auto", time: "0.6s" },
      ],
    },
  ],
};

const UI_DICT = {
  en: {
    badge: "Interactive Live Simulator",
    title1: "Test Sellora's AI Right Here.",
    title2: "No Sign Up Required.",
    subtitle: "Select a common e-commerce scenario below or type your own question to watch how Sellora's AI handles dialect, inventory, and instant payments.",
    step1: "1. Select a Customer Query Scenario:",
    or: "OR TYPE YOUR OWN",
    placeholder: "Type your inquiry here (e.g., Do you offer bulk discounts?)...",
    logHeader: "BACKEND AUTOMATION EXECUTION LOG",
    logSpeed: "● Live 0.7s Avg",
    waHeader: "WhatsApp Business UI Preview",
    waOnline: "Online • Auto-Reply in 0.6s",
    simDevice: "Simulated Customer Device",
    aiTyping: "Sellora AI is crafting response & checking Shopify...",
    aiBadge: "⚡ SELLORA AI AUTO-PILOT",
    footerVerified: "🔒 Verified Meta Business Solution • End-to-End Automated E-Commerce Workflow",
    customReply: "Hello! 🚀 Received your inquiry: ",
    customReplyEnd: ". Sellora's AI engine is analyzing your request, checking Shopify live stock, and generating an instant dialect response!",
  },
  ar: {
    badge: "المحاكي التفاعلي المباشر",
    title1: "جرب ذكاء Sellora الآن بنفسك.",
    title2: "بدون تسجيل حساب.",
    subtitle: "اختر أحد سيناريوهات التجارة الإلكترونية الشائعة أو اكتب سؤالك الخاص لتشاهد كيف يتعامل ذكاء Sellora مع اللهجة، والمخزون، والدفع الفوري.",
    step1: "1. اختر سيناريو استفسار العميل:",
    or: "أو اكتب سؤالك الخاص",
    placeholder: "اكتب استفسارك هنا (مثال: هل في خصم على الكميات؟)...",
    logHeader: "سجل تنفيذ الأتمتة في الخلفية",
    logSpeed: "● استجابة 0.7 ثانية",
    waHeader: "معاينة واجهة واتساب للأعمال",
    waOnline: "متصل • رد تلقائي في 0.6 ثانية",
    simDevice: "محاكاة هاتف العميل",
    aiTyping: "نظام Sellora يحلل السؤال ويراجع شوبيفاي...",
    aiBadge: "⚡ طيار SELLORA الآلي",
    footerVerified: "🔒 شريك معتمد من Meta • أتمتة شاملة للتجارة الإلكترونية",
    customReply: "أهلاً بك! 🚀 استلمنا استفسارك: ",
    customReplyEnd: ". يقوم ذكاء Sellora حالياً بتحليل سؤالك، ومراجعة مخزون شوبيفاي، وإصدار رد فوري باللهجة المصرية الدقيقة!",
  },
  fr: {
    badge: "Simulateur Interactif en Direct",
    title1: "Testez l'IA Sellora Ici.",
    title2: "Sans Inscription.",
    subtitle: "Sélectionnez un scénario e-commerce ci-dessous ou posez votre propre question pour voir comment l'IA Sellora gère le dialecte, le stock et les paiements.",
    step1: "1. Sélectionnez un Scénario Client :",
    or: "OU TAPEZ VOTRE QUESTION",
    placeholder: "Posez votre question ici (ex: Proposez-vous des remises en gros ?)...",
    logHeader: "JOURNAL D'EXÉCUTION AUTOMATISÉE",
    logSpeed: "● Moy. 0,7s en direct",
    waHeader: "Aperçu Interface WhatsApp Business",
    waOnline: "En ligne • Réponse auto en 0,6s",
    simDevice: "Appareil Client Simulé",
    aiTyping: "L'IA Sellora rédige la réponse & vérifie Shopify...",
    aiBadge: "⚡ PILOTE AUTO IA SELLORA",
    footerVerified: "🔒 Solution Vérifiée Meta • Flux E-Commerce 100% Automatisé",
    customReply: "Bonjour ! 🚀 Reçu : ",
    customReplyEnd: ". L'IA Sellora analyse votre demande, vérifie le stock Shopify et formule une réponse personnalisée instantanée !",
  },
};

export default function InteractiveSandbox() {
  const { lang, dir } = useLanguage();
  const presets = PRESETS_DICT[lang] || PRESETS_DICT.en;
  const u = UI_DICT[lang] || UI_DICT.en;

  const [selectedPreset, setSelectedPreset] = useState(presets[0]);
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeLog, setActiveLog] = useState(3);
  const [actionFeedback, setActionFeedback] = useState(null);

  // When language switches, switch to preset 0 of new lang if user hadn't typed custom
  React.useEffect(() => {
    if (selectedPreset.id !== "custom") {
      setSelectedPreset(presets[0]);
    }
  }, [lang, presets]);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setCustomInput("");
    triggerAIAnimation();
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    const customObj = {
      id: "custom",
      icon: <Sparkles size={16} color="#818cf8" />,
      label: "💬 Custom Customer Inquiry",
      userQuery: customInput,
      aiReply: `${u.customReply}"${customInput}"${u.customReplyEnd}`,
      actions: ["⚡ Confirm Order", "💬 Connect Human Agent", "🌟 View Store Catalog"],
      backendLogs: [
        { text: "Processing Custom Dialect NLP Query", time: "0.2s" },
        { text: "Searching Shopify Knowledge Base & FAQ Engine", time: "0.4s" },
        { text: "Formulating Personalized Response with Store Personality", time: "0.6s" },
        { text: "Response Generated • Ready to Send", time: "0.8s" },
      ],
    };
    setSelectedPreset(customObj);
    triggerAIAnimation();
  };

  const triggerAIAnimation = () => {
    setLoading(true);
    setActiveLog(0);
    const t1 = setTimeout(() => setActiveLog(1), 300);
    const t2 = setTimeout(() => setActiveLog(2), 600);
    const t3 = setTimeout(() => {
      setActiveLog(3);
      setLoading(false);
    }, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  return (
    <div className="designer-card" style={{ maxWidth: "1050px", margin: "0 auto", padding: "36px", direction: dir }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <span className="designer-badge" style={{ marginBottom: "12px" }}>
          <span className="dot" /> {u.badge}
        </span>
        <h3 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          {u.title1} <span style={{ color: "#818cf8" }}>{u.title2}</span>
        </h3>
        <p style={{ fontSize: "14px", color: "#94a3b8", maxWidth: "600px", margin: "0 auto" }}>
          {u.subtitle}
        </p>
      </div>

      <div className="sandbox-grid">
        {/* ================= LEFT COLUMN: SCENARIOS & INPUT ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: dir === "rtl" ? "right" : "left" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {u.step1}
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`preset-button ${selectedPreset.id === p.id ? "active" : ""}`}
                style={{ flexDirection: dir === "rtl" ? "row-reverse" : "row" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  {p.icon}
                  <span>{p.label}</span>
                </div>
                <span style={{ fontSize: "12px", opacity: 0.6 }}>{dir === "rtl" ? "←" : "→"}</span>
              </button>
            ))}
          </div>

          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{u.or}</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          <form onSubmit={handleCustomSubmit} style={{ display: "flex", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={u.placeholder}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "10px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#fff",
                fontSize: "13px",
                outline: "none",
                direction: dir,
              }}
            />
            <button
              type="submit"
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                padding: "0 18px",
                borderRadius: "10px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={16} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
            </button>
          </form>

          {/* Backend Actions Real-Time Log */}
          <div style={{ marginTop: "16px", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#818cf8", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <Zap size={13} /> {u.logHeader}
              </span>
              <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 700 }}>{u.logSpeed}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {selectedPreset.backendLogs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: i <= activeLog ? "#e2e8f0" : "#475569",
                    transition: "color 0.3s ease",
                    flexDirection: dir === "rtl" ? "row-reverse" : "row",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    {i <= activeLog ? <Check size={13} color="#10b981" /> : <span style={{ width: "13px", display: "inline-block" }}>○</span>}
                    {log.text}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: "10px", color: i <= activeLog ? "#818cf8" : "#475569" }}>{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: WHATSAPP SIMULATOR ================= */}
        <div style={{ background: "#0c0c0e", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "14px", marginBottom: "16px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{u.waHeader}</div>
                <div style={{ fontSize: "11px", color: "#34d399", display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }} /> {u.waOnline}
                </div>
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
              {u.simDevice}
            </span>
          </div>

          {/* Chat simulator window */}
          <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", minHeight: "280px" }}>
            {actionFeedback && (
              <div style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", padding: "8px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(16,185,129,0.3)", animation: "slide-down 0.2s ease" }}>
                <Check size={14} /> <span>{actionFeedback}</span>
              </div>
            )}
            {/* User message */}
            <div style={{ alignSelf: dir === "rtl" ? "flex-start" : "flex-end", background: "#056162", color: "#fff", padding: "10px 14px", borderRadius: "12px", borderTopRightRadius: dir === "rtl" ? "2px" : "12px", borderTopLeftRadius: dir === "rtl" ? "12px" : "2px", maxWidth: "85%", fontSize: "13px", lineHeight: 1.5, direction: dir }}>
              {selectedPreset.userQuery}
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", textAlign: dir === "rtl" ? "left" : "right", marginTop: "4px" }}>10:14 AM ✔✔</div>
            </div>

            {/* AI Reply */}
            {loading ? (
              <div style={{ alignSelf: dir === "rtl" ? "flex-end" : "flex-start", background: "rgba(255,255,255,0.06)", padding: "12px 18px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <RefreshCw size={14} className="animate-spin" color="#818cf8" />
                <span style={{ fontSize: "12px", color: "#cbd5e1" }}>{u.aiTyping}</span>
              </div>
            ) : (
              <div style={{ alignSelf: dir === "rtl" ? "flex-end" : "flex-start", background: "#1f2937", color: "#fff", padding: "14px", borderRadius: "12px", borderTopLeftRadius: dir === "rtl" ? "12px" : "2px", borderTopRightRadius: dir === "rtl" ? "2px" : "12px", maxWidth: "90%", border: "1px solid rgba(99, 102, 241, 0.3)", boxShadow: "0 10px 25px rgba(0,0,0,0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                    {u.aiBadge}
                  </span>
                </div>
                <p style={{ fontSize: "13px", lineHeight: 1.6, margin: 0, direction: dir, color: "#f8fafc" }}>
                  {selectedPreset.aiReply}
                </p>

                {/* Quick actions button group */}
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedPreset.actions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActionFeedback(`✔ Executed: "${act}" • Verified via Direct Cloud Webhooks`);
                        setTimeout(() => setActionFeedback(null), 4000);
                      }}
                      style={{
                        background: i === 0 ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.06)",
                        color: "#fff",
                        border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s ease",
                        flexDirection: dir === "rtl" ? "row-reverse" : "row",
                      }}
                    >
                      <span>{act}</span>
                      <ArrowRight size={14} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "14px", fontSize: "11px", color: "#64748b", textAlign: "center" }}>
            {u.footerVerified}
          </div>
        </div>
      </div>
    </div>
  );
}
