"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Check, Zap, CreditCard, Sparkles, MessageSquare, ShieldCheck, ShoppingBag, Truck, BarChart3, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const WORKSPACE_DICT = {
  en: {
    headerTitle: "Sellora Mission Control • Live Operating System",
    headerStatus: "● 5 Channels Synchronized & Active",
    kpiRevLabel: "Revenue Today",
    kpiRevVal: "42,500 EGP",
    kpiRevLift: "↑ 34%",
    kpiOrdLabel: "Orders Today",
    kpiOrdVal: "128 Orders",
    kpiOrdLift: "+18%",
    kpiAutoLabel: "Messages Automated",
    kpiAutoVal: "96%",
    kpiAutoSub: "0.8s Reply Time",
    kpiWaitLabel: "Customers Waiting",
    kpiWaitVal: "0",
    kpiWaitSub: "100% Resolved",
    feedTitle: "LIVE AUTONOMOUS COMMERCE FEED",
    feed1: "✔ Instagram Order #1084 Confirmed • Omar Khaled (+650 EGP)",
    feed2: "✔ Paymob InstaPay Checkout Auto-Verified #TX-9921",
    feed3: "✔ Bosta Courier Scheduled • Pickup from Smouha Branch",
    feed4: "✔ Nike Air Max Inventory Auto-Reserved • 14 left in stock",
    feed5: "✔ WhatsApp Inquiry Deflected • Sent Official Fawry Invoice",
    copilotTitle: "SELLORA COPILOT ENGINE",
    copilotSub: "Quiet infrastructure running behind the scenes:",
    c1: "✓ Customer inquired about size 42.",
    c2: "✓ Checked Shopify & reserved stock.",
    c3: "✓ Generated secure Paymob link.",
    c4: "✓ Confirmed payment instantly.",
    c5: "✓ Booked courier shipment.",
    copilotStatus: "Status: All workflows completed without human intervention.",
    footerSync: "Shopify • Meta • Paymob • Bosta Official Routing",
    footerUptime: "2FA Security • 99.99% Uptime",
    obj1: "Shopify Order #1084",
    obj2: "Paymob • +650 EGP Paid",
    obj3: "Bosta • Courier Booked",
    obj4: "Nike Air Max • 14 Left",
  },
  ar: {
    headerTitle: "مركز تحكم Sellora • نظام تشغيل التجارة الإلكترونية",
    headerStatus: "● 5 قنوات متزامنة وتعمل الآن",
    kpiRevLabel: "إيرادات اليوم",
    kpiRevVal: "42,500 ج.م",
    kpiRevLift: "↑ 34%",
    kpiOrdLabel: "أوردرات اليوم",
    kpiOrdVal: "128 أوردر",
    kpiOrdLift: "+18%",
    kpiAutoLabel: "أتمتة المحادثات",
    kpiAutoVal: "96%",
    kpiAutoSub: "0.8 ثانية سرعة الرد",
    kpiWaitLabel: "عملاء في الانتظار",
    kpiWaitVal: "0",
    kpiWaitSub: "100% تم الرد عليهم",
    feedTitle: "سجل العمليات الذاتية المباشر",
    feed1: "✔ تأكيد أوردر إنستجرام #1084 • عمر خالد (+650 ج.م)",
    feed2: "✔ توثيق دفع InstaPay أوتوماتيكياً عبر Paymob #TX-9921",
    feed3: "✔ حجز مندوب شحن بوسطة • استلام من فرع سموحة",
    feed4: "✔ حجز مخزون Nike Air Max أوتوماتيكياً • متبقي 14 قطعة",
    feed5: "✔ الرد على استفسار واتساب • إرسال فاتورة فوري الرسمية",
    copilotTitle: "محرك SELLORA COPILOT",
    copilotSub: "البنية التحتية الذكية تعمل بهدوء في الخلفية:",
    c1: "✓ العميل استفسر عن مقاس 42.",
    c2: "✓ مراجعة شوبيفاي وحجز المقاس.",
    c3: "✓ إصدار رابط دفع Paymob آمن.",
    c4: "✓ تأكيد الدفع لحظياً.",
    c5: "✓ حجز شحنة المندوب.",
    copilotStatus: "الحالة: تم إنجاز كافة العمليات بنجاح دون أي تدخل بشري.",
    footerSync: "ربط رسمي مع شوبيفاي • ميتا • Paymob • بوسطة",
    footerUptime: "أمان ثنائي 2FA • استمرارية 99.99%",
    obj1: "أوردر شوبيفاي #1084",
    obj2: "Paymob • تم دفع +650 ج.م",
    obj3: "بوسطة • تم حجز المندوب",
    obj4: "Nike Air Max • متبقي 14",
  },
  fr: {
    headerTitle: "Centre de Commande Sellora • OS Commerce Live",
    headerStatus: "● 5 Canaux Synchronisés en Direct",
    kpiRevLabel: "Revenus du Jour",
    kpiRevVal: "42 500 EGP",
    kpiRevLift: "↑ 34%",
    kpiOrdLabel: "Commandes du Jour",
    kpiOrdVal: "128 Commandes",
    kpiOrdLift: "+18%",
    kpiAutoLabel: "Messages Automatisés",
    kpiAutoVal: "96%",
    kpiAutoSub: "0,8s Temps de Réponse",
    kpiWaitLabel: "Clients en Attente",
    kpiWaitVal: "0",
    kpiWaitSub: "100% Résolus",
    feedTitle: "FLUX DE COMMERCE AUTONOME EN DIRECT",
    feed1: "✔ Commande Instagram #1084 Confirmée • Omar K. (+650 EGP)",
    feed2: "✔ Paiement InstaPay vérifié auto par Paymob #TX-9921",
    feed3: "✔ Livreur Bosta programmé • Enlèvement agence Smouha",
    feed4: "✔ Stock Nike Air Max réservé auto • 14 restants en stock",
    feed5: "✔ Demande WhatsApp résolue • Facture Fawry expédiée",
    copilotTitle: "MOTEUR SELLORA COPILOT",
    copilotSub: "L'infrastructure invisible qui gère votre boutique :",
    c1: "✓ Le client demande la taille 42.",
    c2: "✓ Vérification stock Shopify.",
    c3: "✓ Lien de paiement Paymob généré.",
    c4: "✓ Paiement confirmé en 1 seconde.",
    c5: "✓ Expédition livreur programmée.",
    copilotStatus: "Statut : Toutes les tâches exécutées sans intervention humaine.",
    footerSync: "Routage Officiel Shopify • Meta • Paymob • Bosta",
    footerUptime: "Sécurité 2FA • Disponibilité 99,99%",
    obj1: "Commande Shopify #1084",
    obj2: "Paymob • +650 EGP Payé",
    obj3: "Bosta • Livreur Réservé",
    obj4: "Nike Air Max • 14 Restants",
  },
};

/**
 * Floating Business Object Glass Cards orbiting around the command center
 */
function FloatingBusinessObjects({ d, dir }) {
  const obj1Ref = useRef();
  const obj2Ref = useRef();
  const obj3Ref = useRef();
  const obj4Ref = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (obj1Ref.current) {
      obj1Ref.current.position.y = Math.sin(t * 1.2) * 0.15 + 1.4;
      obj1Ref.current.position.x = Math.cos(t * 0.8) * 0.2 - 2.8;
    }
    if (obj2Ref.current) {
      obj2Ref.current.position.y = Math.cos(t * 1.4) * 0.15 - 1.3;
      obj2Ref.current.position.x = Math.sin(t * 0.9) * 0.2 - 2.6;
    }
    if (obj3Ref.current) {
      obj3Ref.current.position.y = Math.sin(t * 1.1 + 1) * 0.15 + 1.3;
      obj3Ref.current.position.x = Math.cos(t * 0.7 + 1) * 0.2 + 2.8;
    }
    if (obj4Ref.current) {
      obj4Ref.current.position.y = Math.cos(t * 1.3 + 2) * 0.15 - 1.2;
      obj4Ref.current.position.x = Math.sin(t * 0.8 + 2) * 0.2 + 2.6;
    }
  });

  return (
    <group>
      {/* Object 1: Shopify Order Card */}
      <group ref={obj1Ref} position={[-2.8, 1.4, 0.3]} scale={0.8}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.04]} />
          <meshPhysicalMaterial color="#1e1b4b" roughness={0.2} metalness={0.8} clearcoat={1} />
        </mesh>
        <Html transform position={[0, 0, 0.03]} distanceFactor={3.5}>
          <div style={{ background: "rgba(30, 27, 75, 0.95)", border: "1px solid #6366f1", padding: "6px 12px", borderRadius: "8px", color: "#fff", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.5)", direction: dir }}>
            <ShoppingBag size={12} color="#818cf8" />
            <span>{d.obj1}</span>
            <span style={{ background: "#10b981", padding: "2px 6px", borderRadius: "4px", fontSize: "9px" }}>✔ Confirmed</span>
          </div>
        </Html>
      </group>

      {/* Object 2: Paymob Receipt */}
      <group ref={obj2Ref} position={[-2.6, -1.3, 0.3]} scale={0.8}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.04]} />
          <meshPhysicalMaterial color="#064e3b" roughness={0.2} metalness={0.8} clearcoat={1} />
        </mesh>
        <Html transform position={[0, 0, 0.03]} distanceFactor={3.5}>
          <div style={{ background: "rgba(6, 78, 59, 0.95)", border: "1px solid #10b981", padding: "6px 12px", borderRadius: "8px", color: "#fff", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.5)", direction: dir }}>
            <CreditCard size={12} color="#34d399" />
            <span>{d.obj2}</span>
          </div>
        </Html>
      </group>

      {/* Object 3: Courier Booked */}
      <group ref={obj3Ref} position={[2.8, 1.3, 0.3]} scale={0.8}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.04]} />
          <meshPhysicalMaterial color="#451a03" roughness={0.2} metalness={0.8} clearcoat={1} />
        </mesh>
        <Html transform position={[0, 0, 0.03]} distanceFactor={3.5}>
          <div style={{ background: "rgba(69, 26, 3, 0.95)", border: "1px solid #f59e0b", padding: "6px 12px", borderRadius: "8px", color: "#fff", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.5)", direction: dir }}>
            <Truck size={12} color="#fbbf24" />
            <span>{d.obj3}</span>
          </div>
        </Html>
      </group>

      {/* Object 4: Low Stock Alert */}
      <group ref={obj4Ref} position={[2.6, -1.2, 0.3]} scale={0.8}>
        <mesh>
          <boxGeometry args={[1.8, 0.6, 0.04]} />
          <meshPhysicalMaterial color="#31102f" roughness={0.2} metalness={0.8} clearcoat={1} />
        </mesh>
        <Html transform position={[0, 0, 0.03]} distanceFactor={3.5}>
          <div style={{ background: "rgba(49, 16, 47, 0.95)", border: "1px solid #ec4899", padding: "6px 12px", borderRadius: "8px", color: "#fff", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.5)", direction: dir }}>
            <AlertCircle size={12} color="#f472b6" />
            <span>{d.obj4}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

function CommandCenterGlassFrame({ d, dir }) {
  const groupRef = useRef();
  const [ticker, setTicker] = useState(42500);
  const [orderCount, setOrderCount] = useState(128);

  // Self-running autonomous ticker animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((prev) => prev + 650);
      setOrderCount((prev) => prev + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const { x, y } = state.pointer;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, x * 0.12, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -y * 0.08, 0.05);
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.3}>
        {/* Main 3D Glass Dashboard Background */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[5.2, 3.4, 0.06]} />
          <meshPhysicalMaterial
            color="#0d0e14"
            roughness={0.12}
            metalness={0.85}
            clearcoat={1}
            clearcoatRoughness={0.1}
            wireframe={false}
          />
        </mesh>

        {/* Glowing Bezel */}
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[5.24, 3.44, 0.04]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.35} />
        </mesh>

        {/* Embedded High-Fidelity Business OS HTML */}
        <Html transform position={[0, 0, 0.04]} distanceFactor={3.1}>
          <div
            style={{
              width: "480px",
              background: "rgba(10, 11, 16, 0.96)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "0 30px 70px rgba(0, 0, 0, 0.8)",
              color: "#fff",
              fontFamily: "'Inter', sans-serif",
              userSelect: "none",
              direction: dir,
              textAlign: dir === "rtl" ? "right" : "left",
            }}
          >
            {/* Top Command Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", marginBottom: "12px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#f8fafc", letterSpacing: "0.02em" }}>{d.headerTitle}</span>
              </div>
              <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 600, background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: "6px" }}>
                {d.headerStatus}
              </span>
            </div>

            {/* KPI Cards Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" }}>
              {/* Card 1: Revenue */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: "10px" }}>
                <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.kpiRevLabel}</div>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#fff", margin: "2px 0" }}>
                  {ticker.toLocaleString()} <span style={{ fontSize: "10px", color: "#818cf8" }}>{dir === "rtl" ? "ج.م" : "EGP"}</span>
                </div>
                <div style={{ fontSize: "9px", color: "#34d399", fontWeight: 700 }}>{d.kpiRevLift}</div>
              </div>

              {/* Card 2: Orders */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: "10px" }}>
                <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.kpiOrdLabel}</div>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#fff", margin: "2px 0" }}>{orderCount}</div>
                <div style={{ fontSize: "9px", color: "#34d399", fontWeight: 700 }}>{d.kpiOrdLift}</div>
              </div>

              {/* Card 3: Automated */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: "10px" }}>
                <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.kpiAutoLabel}</div>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#818cf8", margin: "2px 0" }}>{d.kpiAutoVal}</div>
                <div style={{ fontSize: "9px", color: "#64748b" }}>{d.kpiAutoSub}</div>
              </div>

              {/* Card 4: Waiting */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: "10px" }}>
                <div style={{ fontSize: "9.5px", color: "#94a3b8" }}>{d.kpiWaitLabel}</div>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#34d399", margin: "2px 0" }}>{d.kpiWaitVal}</div>
                <div style={{ fontSize: "9px", color: "#64748b" }}>{d.kpiWaitSub}</div>
              </div>
            </div>

            {/* Split Workspace Body */}
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "10px", minHeight: "180px" }}>
              {/* Left Column: Live Activity Feed */}
              <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>
                  {d.feedTitle}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "10px", color: "#cbd5e1" }}>
                  <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", padding: "5px 8px", borderRadius: "6px", color: "#34d399", fontWeight: 600 }}>
                    {d.feed1}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 8px", borderRadius: "6px" }}>
                    {d.feed2}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 8px", borderRadius: "6px" }}>
                    {d.feed3}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 8px", borderRadius: "6px" }}>
                    {d.feed4}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "5px 8px", borderRadius: "6px" }}>
                    {d.feed5}
                  </div>
                </div>
              </div>

              {/* Right Column: Quiet Copilot Working */}
              <div style={{ background: "linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "12px", padding: "10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#c7d2fe", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <Sparkles size={12} color="#818cf8" /> {d.copilotTitle}
                  </div>
                  <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: "8px" }}>{d.copilotSub}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "9.5px", color: "#e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><Check size={11} color="#34d399" /> <span>{d.c1}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><Check size={11} color="#34d399" /> <span>{d.c2}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><Check size={11} color="#34d399" /> <span>{d.c3}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><Check size={11} color="#34d399" /> <span>{d.c4}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}><Check size={11} color="#34d399" /> <span>{d.c5}</span></div>
                  </div>
                </div>
                <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "8.5px", color: "#818cf8", fontWeight: 600 }}>
                  {d.copilotStatus}
                </div>
              </div>
            </div>

            {/* Bottom Status */}
            <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "9.5px", color: "#64748b", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <ShieldCheck size={12} color="#10b981" /> {d.footerSync}
              </span>
              <span>{d.footerUptime}</span>
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
}

export default function LiveProductHero3D() {
  const { lang, dir } = useLanguage();
  const d = WORKSPACE_DICT[lang] || WORKSPACE_DICT.en;

  return (
    <div style={{ width: "100%", height: "540px", position: "relative" }}>
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5.5]} fov={50} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} color="#6366f1" intensity={2} />
        <pointLight position={[10, -10, 10]} color="#00d2ff" intensity={1.5} />
        <CommandCenterGlassFrame d={d} dir={dir} />
        <FloatingBusinessObjects d={d} dir={dir} />
      </Canvas>
    </div>
  );
}
