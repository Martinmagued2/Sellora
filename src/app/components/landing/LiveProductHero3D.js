"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Check, Zap, CreditCard, Sparkles, MessageSquare, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const DICT = {
  en: {
    vipHeader: "WhatsApp VIP • Live Inbox",
    customerName: "Customer: Omar Khaled (+20 109 452 811)",
    activePilot: "⚡ Auto-Pilot Active",
    customerMsg: "Hi, can I get the price of the sneaker size 42 and shipping to Cairo? Is express delivery available?",
    msgMeta: "10:14 AM • via WhatsApp Catalog",
    typing: "Sellora AI analyzing Shopify catalog & Paymob inventory...",
    aiHeader: "AI Automated Reply • 0.6s",
    aiReply: "Welcome Omar! 👟 The price is 650 EGP and size 42 is in stock at Smouha branch. Express delivery to Cairo arrives within 24 hours! Would you like to confirm COD or pay via InstaPay?",
    btnConfirm: "⚡ Confirm Order (+650 EGP)",
    btnInsta: "💳 InstaPay Link",
    orderSuccess: "Order #1084 confirmed! Fawry electronic invoice sent.",
    footerSync: "Paymob & Shopify Live Sync",
    footerVerified: "2FA Verified • Zero Human Delay",
    toast: "✨ Paymob Checkout Link Auto-Sent • +650 EGP Added to Daily Revenue!",
    productBoxLabel: "3D LIVE PRODUCT VIEW • SKU: SNK-42",
  },
  ar: {
    vipHeader: "واتساب VIP • صندوق الرسائل المباشر",
    customerName: "العميل: عمر خالد (+20 109 452 811)",
    activePilot: "⚡ الطيار الآلي يعمل",
    customerMsg: "ممكن أعرف سعر الكوتشي المقاس 42 وعنوان فرع اسكندرية وهل في شحن سريع للقاهرة؟",
    msgMeta: "10:14 صباحاً • عبر كتالوج واتساب",
    typing: "نظام Sellora يحلل مخزون شوبيفاي ورصيد باي موب...",
    aiHeader: "رد آلي فوري • 0.6 ثانية",
    aiReply: "أهلاً بك يا أستاذ عمر! 👟 السعر 650 ج.م ومقاس 42 متاح في فرع سموحة. الشحن السريع للقاهرة بيوصل خلال 24 ساعة! تحب أكدلك الأوردر الدفع عند الاستلام ولا برابط InstaPay؟",
    btnConfirm: "⚡ تأكيد الأوردر (+650 ج.م)",
    btnInsta: "💳 رابط InstaPay",
    orderSuccess: "تم إنشاء أوردر #1084 بنجاح وإرسال فاتورة فوري!",
    footerSync: "مزامنة لحظية مع Paymob و Shopify",
    footerVerified: "تحقق ثنائي • بدون تأخير بشري",
    toast: "✨ تم إرسال رابط دفع Paymob أوتوماتيكياً • إضافة +650 ج.م للإيرادات!",
    productBoxLabel: "عرض 3D حي للمنتج • SKU: SNK-42",
  },
  fr: {
    vipHeader: "WhatsApp VIP • Boîte Directe",
    customerName: "Client : Omar Khaled (+20 109 452 811)",
    activePilot: "⚡ Pilote Auto Actif",
    customerMsg: "Bonjour, quel est le prix des baskets taille 42 et la livraison pour Le Caire ? Livraison express disponible ?",
    msgMeta: "10:14 • via Catalogue WhatsApp",
    typing: "L'IA Sellora analyse le catalogue Shopify & Paymob...",
    aiHeader: "Réponse IA Auto • 0,6s",
    aiReply: "Bienvenue Omar ! 👟 Le prix est de 650 EGP et la taille 42 est en stock à Alexandrie (Smouha). Livraison express au Caire en 24h ! Souhaitez-vous confirmer la commande ou payer par InstaPay ?",
    btnConfirm: "⚡ Confirmer Commande (+650 EGP)",
    btnInsta: "💳 Lien InstaPay",
    orderSuccess: "Commande #1084 confirmée ! Facture Fawry expédiée.",
    footerSync: "Synchro Live Paymob & Shopify",
    footerVerified: "Vérifié 2FA • Zéro Délai Humain",
    toast: "✨ Lien de paiement Paymob envoyé • +650 EGP ajoutés au revenu !",
    productBoxLabel: "VUE PRODUIT 3D • SKU: SNK-42",
  },
};

/**
 * Floating 3D Product Card & E-Commerce Cube — spins and reacts to mouse/click
 */
function FloatingProductBox3D({ lang, d }) {
  const boxRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (boxRef.current) {
      boxRef.current.rotation.y += delta * (hovered ? 1.5 : 0.4);
      boxRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
      boxRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.12 + 0.3;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.6;
      ringRef.current.rotation.x += delta * 0.2;
    }
  });

  return (
    <group position={[2.6, 0.2, 0.4]} scale={0.75}>
      {/* Outer Orbit Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.3, 0.03, 16, 64]} />
        <meshBasicMaterial color="#10b981" wireframe={true} transparent opacity={0.6} />
      </mesh>

      {/* Spinning 3D E-Commerce Package Cube */}
      <mesh
        ref={boxRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.2, 1.4, 1.2]} />
        <meshPhysicalMaterial
          color={hovered ? "#4f46e5" : "#1e1b4b"}
          roughness={0.2}
          metalness={0.7}
          clearcoat={1}
          clearcoatRoughness={0.1}
          reflectivity={1}
        />
      </mesh>

      {/* Floating Price Tag HTML over the 3D Product Cube */}
      <Html position={[0, -1.1, 0]} center distanceFactor={4}>
        <div style={{ background: "rgba(16, 185, 129, 0.9)", color: "#fff", padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(16,185,129,0.4)", border: "1px solid #fff" }}>
          👟 650 EGP • INSTAPAY READY
        </div>
      </Html>
    </group>
  );
}

function GlassAppFrame({ onOrderConfirmed, lang, d, dir }) {
  const groupRef = useRef();
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);

  // Auto-cycle chat animation
  useEffect(() => {
    const timer1 = setTimeout(() => setTyping(true), 1200);
    const timer2 = setTimeout(() => {
      setTyping(false);
      setStep(1);
    }, 2800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Smooth mouse follow (Linear / Vercel style tilt)
  useFrame((state) => {
    if (!groupRef.current) return;
    const { x, y } = state.pointer;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, x * 0.18, 0.06);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -y * 0.12, 0.06);
  });

  const handleConfirmOrder = () => {
    setOrderCreated(true);
    if (onOrderConfirmed) onOrderConfirmed();
  };

  return (
    <group ref={groupRef} position={[-0.4, 0, 0]}>
      <Float speed={1.5} rotationIntensity={0.12} floatIntensity={0.4}>
        {/* 3D Glass Bezel Background */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[4.4, 3.2, 0.08]} />
          <meshPhysicalMaterial
            color="#12131a"
            roughness={0.15}
            metalness={0.8}
            clearcoat={1}
            clearcoatRoughness={0.1}
            wireframe={false}
          />
        </mesh>

        {/* Glowing border frame */}
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[4.44, 3.24, 0.06]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.3} />
        </mesh>

        {/* Embedded High-Fidelity UI HTML Mockup */}
        <Html transform position={[0, 0, 0.05]} distanceFactor={3.1}>
          <div
            style={{
              width: "390px",
              background: "rgba(13, 14, 20, 0.96)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              userSelect: "none",
              direction: dir,
              textAlign: dir === "rtl" ? "right" : "left",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "14px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, #25D366, #128C7E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <span>{d.vipHeader}</span>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#94A3B8" }}>{d.customerName}</div>
                </div>
              </div>
              <span style={{ fontSize: "10px", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "4px 8px", borderRadius: "20px", border: "1px solid rgba(99, 102, 241, 0.3)", fontWeight: 600 }}>
                {d.activePilot}
              </span>
            </div>

            {/* Chat Body */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "200px" }}>
              {/* Customer Message */}
              <div style={{ alignSelf: dir === "rtl" ? "flex-end" : "flex-start", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.06)", padding: "10px 14px", borderRadius: "12px", borderTopLeftRadius: dir === "rtl" ? "12px" : "2px", borderTopRightRadius: dir === "rtl" ? "2px" : "12px", maxWidth: "85%" }}>
                <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#e2e8f0", margin: 0 }}>
                  {d.customerMsg}
                </p>
                <span style={{ fontSize: "9px", color: "#64748b", marginTop: "4px", display: "block", textAlign: dir === "rtl" ? "left" : "right" }}>{d.msgMeta}</span>
              </div>

              {/* Typing Indicator */}
              {typing && (
                <div style={{ alignSelf: dir === "rtl" ? "flex-start" : "flex-end", background: "rgba(99, 102, 241, 0.2)", padding: "8px 14px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                  <span style={{ fontSize: "11px", color: "#818cf8" }}>{d.typing}</span>
                </div>
              )}

              {/* AI Copilot Reply */}
              {step >= 1 && (
                <div style={{ alignSelf: dir === "rtl" ? "flex-start" : "flex-end", background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", padding: "12px 14px", borderRadius: "12px", borderTopRightRadius: dir === "rtl" ? "12px" : "2px", borderTopLeftRadius: dir === "rtl" ? "2px" : "12px", maxWidth: "90%", boxShadow: "0 8px 20px rgba(79, 70, 229, 0.3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <Sparkles size={11} color="#c7d2fe" />
                    <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d.aiHeader}</span>
                  </div>
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#fff", margin: 0 }}>
                    {d.aiReply}
                  </p>
                  
                  {/* Quick Action Buttons inside Chat */}
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", flexWrap: "wrap", gap: "6px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    {!orderCreated ? (
                      <>
                        <button
                          onClick={handleConfirmOrder}
                          style={{
                            background: "#fff",
                            color: "#0f172a",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(255,255,255,0.2)",
                            flexDirection: dir === "rtl" ? "row-reverse" : "row",
                          }}
                        >
                          <Zap size={12} color="#4f46e5" /> {d.btnConfirm}
                        </button>
                        <button
                          onClick={handleConfirmOrder}
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            flexDirection: dir === "rtl" ? "row-reverse" : "row",
                          }}
                        >
                          <CreditCard size={12} /> {d.btnInsta}
                        </button>
                      </>
                    ) : (
                      <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", width: "100%", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                        <Check size={14} /> {d.orderSuccess}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer status */}
            <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#64748b", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <ShieldCheck size={12} color="#10b981" /> {d.footerSync}
              </span>
              <span>{d.footerVerified}</span>
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
}

export default function LiveProductHero3D() {
  const [showToast, setShowToast] = useState(false);
  const { lang, dir } = useLanguage();
  const d = DICT[lang] || DICT.en;

  const handleOrderConfirmed = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <div style={{ width: "100%", height: "540px", position: "relative" }}>
      {/* Floating Success Toast when order clicked */}
      {showToast && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)",
            zIndex: 50,
            animation: "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            flexDirection: dir === "rtl" ? "row-reverse" : "row",
          }}
        >
          <Sparkles size={16} /> {d.toast}
        </div>
      )}

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5.2]} fov={50} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} color="#6366f1" intensity={2} />
        <pointLight position={[10, -10, 10]} color="#00d2ff" intensity={1.5} />
        <GlassAppFrame onOrderConfirmed={handleOrderConfirmed} lang={lang} d={d} dir={dir} />
        <FloatingProductBox3D lang={lang} d={d} />
      </Canvas>
    </div>
  );
}
