"use client";

import React from "react";
import { ShieldCheck, Code2, Server, Lock, Sparkles, ArrowRight, HeartHandshake, CheckCircle2, MessageSquareQuote, Layers, Terminal } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const TRUST_DICT = {
  en: {
    badge: "Beta Feedback & What Early Users Are Saying",
    title1: "Built for Modern E-Commerce.",
    title2: "Backed by Zero BS.",
    subtitle: "We believe trust is earned through transparency and software performance—not fake testimonials, fabricated follower counts, or inflated statistics.",
    skeletonTitle: "Beta Merchant Feedback Coming Soon",
    skeletonDesc: "We are currently onboarding our first 100 beta stores across Egypt and the MENA region. We refuse to publish fabricated user quotes or fake social proof. Real merchant case studies and verifiable performance metrics will be published here as our beta program expands.",
    joinBtn: "Join the First 100 Beta Stores",
    storyBadge: "THE FOUNDER & BUILDER STORY",
    storyTitle: "Why We Built Sellora",
    storyP1: "As software engineers and e-commerce builders in Egypt and MENA, we watched local sellers and brand owners struggle with a daily operational nightmare: juggling 18 unread WhatsApp tabs, manually copying product prices until 2 AM, and losing up to 40% of orders to faster competitors while verifying Vodafone Cash and InstaPay screenshots by hand.",
    storyP2: "We realized that existing AI chatbots only added to the noise by acting as gimmicky text generators that still required constant human supervision. We built Sellora to be the unified operating system that silently runs modern social commerce—connecting customer intent directly to inventory locking, instant banking webhooks, and automated courier dispatch.",
    techBadge: "TECHNICAL TRANSPARENCY & SECURITY",
    techTitle: "Enterprise-Grade Infrastructure You Can Inspect",
    t1Title: "Modern Serverless Architecture",
    t1Desc: "Engineered for sub-second page loads, real-time data synchronization, and absolute reliability across all devices.",
    t2Title: "Supabase Server-Side RLS",
    t2Desc: "Strict Row-Level Security policies and mandatory two-factor authentication (2FA) enforce absolute data isolation between merchant stores.",
    t3Title: "Direct Cloud APIs & Webhooks",
    t3Desc: "Direct integration with WhatsApp Business Cloud API and banking webhook listeners ensure 100% verified checkouts without manual review.",
    t4Title: "Sub-Second Dialect NLP Engine",
    t4Desc: "Advanced natural language processing specifically tuned for Egyptian Arabic and Gulf dialects, delivering responses in under 1 second.",
  },
  ar: {
    badge: "آراء المستخدمين الأوائل وملاحظات النسخة التجريبية",
    title1: "بُني لتجارة إلكترونية حديثة.",
    title2: "بشفافية ومصداقية تامة.",
    subtitle: "نؤمن بأن الثقة تُكتسب من خلال الشفافية وكفاءة النظام—وليس من خلال التقييمات الوهمية أو أرقام المتابعين المزيفة أو الإحصائيات المبالغ فيها.",
    skeletonTitle: "آراء تجار النسخة التجريبية (قريباً)",
    skeletonDesc: "نحن نضم حالياً أول 100 متجر تجريبي في مصر ومنطقة الشرق الأوسط. نرفض قطعياً نشر أي تقييمات وهمية أو اقتباسات غير حقيقية. سيتم نشر دراسات الحالة الحقيقية والأرقام الموثقة هنا مع توسع برنامجنا التجريبي.",
    joinBtn: "انضم لأول 100 متجر تجريبي",
    storyBadge: "قصة المطورين والمؤسسين",
    storyTitle: "لماذا قمنا ببناء Sellora",
    storyP1: "كمطورين ومهندسين برمجيات في مصر والمنطقة، شاهدنا أصحاب المتاجر والعلامات التجارية المحلية يعانون يومياً من كابوس تشغيلي: التشتت بين 18 شات واتساب مفتوح في نفس الوقت، ونسخ ولصق الأسعار يدوياً حتى الثانية صباحاً، وخسارة 40% من المبيعات لصالح منافسين أسرع أثناء مراجعة سكرين شوت إنستاباي وفودافون كاش يدوياً.",
    storyP2: "أدركنا أن روبوتات الدردشة العادية (Chatbots) تزيد الطين بلة لأنها مجرد مولدات نصوص تتطلب مراقبة بشرية مستمرة. لذلك بنينا Sellora ليكون نظام التشغيل المتكامل الذي يدير التجارة الإلكترونية بصمت وذكاء—بيربط قصد العميل مباشرة بحجز المخزون، وتأكيد بوابات الدفع اللحظية، وإرسال أوامر الشحن لشركات التوصيل أوتوماتيكياً.",
    techBadge: "الشفافية التقنية وأمان البيانات",
    techTitle: "بنية تحتية بمواصفات المؤسسات الكبرى",
    t1Title: "بنية سحابية حديثة وفائقة السرعة",
    t1Desc: "مصمم لضمان سرعة تحميل فائقة ومزامنة لحظية للبيانات وكفاءة تشغيلية في جميع الأجهزة والشاشات.",
    t2Title: "أمان Supabase RLS المتقدم",
    t2Desc: "سياسات عزل بيانات صارمة (Row-Level Security) وتفعيل التحقق الثنائي (2FA) لضمان سرية وحماية تامة لبيانات متجرك وعملائك.",
    t3Title: "ربط مباشر عبر الويب هوك والـ APIs",
    t3Desc: "ربط مباشر وسريع مع سحابة WhatsApp Business الرسمية وبوابات الدفع اللحظية لضمان توثيق المدفوعات دون أي تدخل بشري.",
    t4Title: "محرك معالجة اللهجات الفوري",
    t4Desc: "معالجة لغوية متطورة في أقل من ثانية ومخصصة بدقة لفهم العامية المصرية والهجات العربية في التجارة الإلكترونية.",
  },
  fr: {
    badge: "Retours Bêta & Témoignages des Premiers Utilisateurs",
    title1: "Conçu pour le Commerce Moderne.",
    title2: "100% Transparent, Zéro BS.",
    subtitle: "Nous croyons que la confiance se mérite par la transparence et la performance du logiciel — pas par de faux témoignages ou des statistiques gonflées.",
    skeletonTitle: "Retours des Commerçants Bêta (À venir)",
    skeletonDesc: "Nous intégrons actuellement nos 100 premières boutiques bêta en Égypte et dans la zone MENA. Nous refusons de publier de fausses citations. De véritables études de cas et des métriques vérifiables seront publiées ici à mesure que notre programme s'étend.",
    joinBtn: "Rejoindre les 100 Premiers Commerçants",
    storyBadge: "L'HISTOIRE DES FONDATEURS",
    storyTitle: "Pourquoi nous avons créé Sellora",
    storyP1: "En tant qu'ingénieurs logiciels et créateurs e-commerce dans la région MENA, nous avons vu les commerçants locaux lutter chaque jour : gérer 18 onglets WhatsApp non lus, copier-coller les prix à 2h du matin, et perdre jusqu'à 40% de commandes face à des concurrents plus rapides en vérifiant manuellement les reçus InstaPay et Vodafone Cash.",
    storyP2: "Nous avons réalisé que les chatbots IA classiques n'étaient que de simples générateurs de texte nécessitant une surveillance humaine constante. Nous avons conçu Sellora comme le système d'exploitation unifié qui gère le commerce social de bout en bout : réservant le stock, vérifiant les reçus bancaires par webhook et planifiant les livreurs 100% en autonomie.",
    techBadge: "TRANSPARENCE TECHNIQUE & SÉCURITÉ",
    techTitle: "Une Infrastructure de Pointe Inspectionnable",
    t1Title: "Architecture Serverless Moderne",
    t1Desc: "Conçu pour des temps de chargement ultra-rapides, une synchronisation instantanée et une fiabilité absolue.",
    t2Title: "Sécurité Supabase RLS",
    t2Desc: "Politiques strictes de sécurité au niveau des lignes (RLS) et authentification à deux facteurs (2FA) pour une isolation totale des données.",
    t3Title: "APIs Cloud & Webhooks Directs",
    t3Desc: "Intégration directe avec WhatsApp Business Cloud API et webhooks bancaires pour des vérifications 100% automatisées sans révision manuelle.",
    t4Title: "Moteur NLP Dialecte Instantané",
    t4Desc: "Traitement du langage naturel de pointe, spécialement optimisé pour l'arabe égyptien et les dialectes du Golfe en moins d'une seconde.",
  },
};

export default function HonestTrustSection() {
  const { lang, dir } = useLanguage();
  const d = TRUST_DICT[lang] || TRUST_DICT.en;

  return (
    <section className="section" id="testimonials" style={{ background: "var(--bg-primary)", padding: "80px 0", direction: dir }}>
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <span className="designer-badge" style={{ marginBottom: "16px" }}>
            <span className="dot" /> {d.badge}
          </span>
          <h2 className="designer-title" style={{ fontSize: "2.8rem" }}>
            {d.title1} <span style={{ color: "#34d399" }}>{d.title2}</span>
          </h2>
          <p className="designer-subtitle" style={{ maxWidth: "680px" }}>
            {d.subtitle}
          </p>
        </div>

        {/* ================= 1. EMPTY / SKELETON TESTIMONIAL STATES ================= */}
        <div style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)", border: "1px dashed rgba(255, 255, 255, 0.15)", borderRadius: "20px", padding: "40px", marginBottom: "64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
            <MessageSquareQuote size={28} />
          </div>
          <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "12px" }}>
            {d.skeletonTitle}
          </h3>
          <p style={{ fontSize: "14.5px", color: "#94a3b8", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.6 }}>
            {d.skeletonDesc}
          </p>

          {/* Skeleton Cards Row */}
          <div className="trust-skeleton-grid">
            {[1, 2, 3].map((item) => (
              <div key={item} style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "14px", padding: "20px", textAlign: dir === "rtl" ? "right" : "left" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                  {[...Array(5)].map((_, j) => (<span key={j} style={{ color: "#475569", fontSize: "14px" }}>★</span>))}
                </div>
                <div style={{ height: "10px", width: "90%", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px", marginBottom: "8px" }} />
                <div style={{ height: "10px", width: "70%", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px", marginBottom: "16px" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.1)" }} />
                  <div>
                    <div style={{ height: "8px", width: "80px", background: "rgba(255, 255, 255, 0.15)", borderRadius: "3px", marginBottom: "4px" }} />
                    <div style={{ height: "7px", width: "50px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <a href="/signup" className="btn-designer-primary">
            {d.joinBtn} <ArrowRight size={16} style={{ transform: dir === "rtl" ? "rotate(180deg)" : "none" }} />
          </a>
        </div>

        {/* ================= 2. FOUNDER & BUILDER STORY SECTION ================= */}
        <div className="trust-story-grid">
          <div style={{ textAlign: dir === "rtl" ? "right" : "left" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <HeartHandshake size={14} /> {d.storyBadge}
            </div>
            <h3 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "16px" }}>
              {d.storyTitle}
            </h3>
            <p style={{ fontSize: "14.5px", color: "#e2e8f0", lineHeight: 1.7, marginBottom: "16px" }}>
              {d.storyP1}
            </p>
            <p style={{ fontSize: "14.5px", color: "#cbd5e1", lineHeight: 1.7 }}>
              {d.storyP2}
            </p>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "18px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <Terminal size={16} color="#34d399" /> <span>Our Core Builder Principles</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", color: "#94a3b8" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>No Fake Numbers:</strong> What you see in our demos is actual system behavior, not fabricated stats.</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>100% Arabic &amp; Dialect Native:</strong> Engineered from day one for Egypt and the Gulf, not translated as an afterthought.</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span><strong>Direct Bank &amp; Courier Webhooks:</strong> Zero manual screenshots or human approval queues.</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. TECHNICAL TRANSPARENCY & SECURITY ================= */}
        <div>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Lock size={14} /> {d.techBadge}
            </span>
            <h3 style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginTop: "6px" }}>
              {d.techTitle}
            </h3>
          </div>

          <div className="trust-tech-grid">
            {[
              { icon: <Code2 size={22} color="#818cf8" />, title: d.t1Title, desc: d.t1Desc, border: "#6366f1" },
              { icon: <Server size={22} color="#34d399" />, title: d.t2Title, desc: d.t2Desc, border: "#10b981" },
              { icon: <ShieldCheck size={22} color="#f59e0b" />, title: d.t3Title, desc: d.t3Desc, border: "#f59e0b" },
              { icon: <Sparkles size={22} color="#00d2ff" />, title: d.t4Title, desc: d.t4Desc, border: "#00d2ff" },
            ].map((item, i) => (
              <div
                key={i}
                className="designer-card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderTop: `3px solid ${item.border}`,
                  textAlign: dir === "rtl" ? "right" : "left",
                }}
              >
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.04)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  {item.icon}
                </div>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>{item.title}</h4>
                <p style={{ fontSize: "12.5px", color: "#94a3b8", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
