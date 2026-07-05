"use client";

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Globe, Sparkles, Zap, ShieldCheck, Activity } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./landing.css";

const GLOBE_DICT = {
  en: {
    badge: "3D LIVE COMMERCE NETWORK",
    title1: "Automating E-Commerce Across",
    title2: "MENA & Beyond.",
    subtitle: "Explore our live neural routing network. Sellora synchronizes orders, dialects, and payment gateways across major regional hubs with sub-second latency.",
    hub1: "Cairo & Alexandria • Live",
    sub1: "Paymob & InstaPay Gateway Active",
    hub2: "Riyadh Hub • VIP",
    sub2: "Arabic NLP Dialect Engine Active",
    hub3: "Dubai Hub • Pro",
    sub3: "Shopify Live Inventory Sync",
    hub4: "Paris / London EU Hub",
    sub4: "Stripe & Meta Official Routing",
    footerStat: "● 99.99% Global Uptime • Zero Data Loss across 5 Million+ Transactions",
    tip: "💡 Interactive 3D Model: Click and drag to rotate the neural network sphere.",
  },
  ar: {
    badge: "شبكة التجارة الحية ثلاثية الأبعاد 3D",
    title1: "أتمتة التجارة الإلكترونية عبر",
    title2: "الشرق الأوسط والعالم.",
    subtitle: "استكشف شبكة التوجيه العصبي الحية. يقوم نظام Sellora بمزامنة الأوردرات واللهجات وبوابات الدفع عبر أهم المراكز الإقليمية بسرعة فائقة دون تأخير.",
    hub1: "القاهرة والإسكندرية • مباشر",
    sub1: "بوابات Paymob و InstaPay نشطة",
    hub2: "مركز الرياض • VIP",
    sub2: "محرك معالجة اللهجات العربية نشط",
    hub3: "مركز دبي • Pro",
    sub3: "مزامنة مخزون شوبيفاي لحظياً",
    hub4: "مركز باريس ولندن الأوروبي",
    sub4: "توجيه معتمد من Stripe و Meta",
    footerStat: "● 99.99% استمرارية تشغيل عالمية • صفر فقدان بيانات عبر +5 مليون عملية",
    tip: "💡 نموذج 3D تفاعلي: اضغط واسحب لتدوير كرة الشبكة العصبية.",
  },
  fr: {
    badge: "RÉSEAU DE COMMERCE 3D EN DIRECT",
    title1: "Automatisation E-Commerce dans",
    title2: "la zone MENA & au-delà.",
    subtitle: "Explorez notre réseau de routage en temps réel. Sellora synchronise commandes, dialectes et passerelles de paiement à travers les grands hubs régionaux en moins d'une seconde.",
    hub1: "Le Caire & Alexandrie • Live",
    sub1: "Passerelle Paymob & InstaPay Actives",
    hub2: "Hub Riyad • VIP",
    sub2: "Moteur NLP Dialecte Arabe Actif",
    hub3: "Hub Dubaï • Pro",
    sub3: "Synchro Stock Shopify en Direct",
    hub4: "Hub Paris / Londres EU",
    sub4: "Routage Officiel Stripe & Meta",
    footerStat: "● 99,99% Disponibilité Globale • Zéro Perte sur +5 Millions de Transactions",
    tip: "💡 Modèle 3D Interactif : Cliquez et glissez pour faire pivoter la sphère du réseau.",
  },
};

function latLonToVec3(lat, lon, radius = 2.2) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function WireGlobe({ d, dir }) {
  const globeRef = useRef();
  const ringRef = useRef();
  const [activeNode, setActiveNode] = useState(0);

  // Auto cycle active node
  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveNode((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 0.1;
      ringRef.current.rotation.y -= delta * 0.08;
    }
  });

  const hubs = useMemo(() => [
    { name: d.hub1, sub: d.sub1, pos: latLonToVec3(30.0444, 31.2357, 2.22), color: "#10b981", tag: "EG" },
    { name: d.hub2, sub: d.sub2, pos: latLonToVec3(24.7136, 46.6753, 2.22), color: "#6366f1", tag: "SA" },
    { name: d.hub3, sub: d.sub3, pos: latLonToVec3(25.2048, 55.2708, 2.22), color: "#00d2ff", tag: "AE" },
    { name: d.hub4, sub: d.sub4, pos: latLonToVec3(48.8566, 2.3522, 2.22), color: "#f59e0b", tag: "EU" },
  ], [d]);

  return (
    <group>
      {/* Outer Glow Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.8, 0.02, 16, 100]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.3} wireframe />
      </mesh>

      {/* Main Wireframe Sphere */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshPhysicalMaterial
          color="#181824"
          wireframe={true}
          transparent
          opacity={0.35}
          roughness={0.4}
          metalness={0.8}
        />
        <mesh>
          <sphereGeometry args={[2.15, 24, 24]} />
          <meshBasicMaterial color="#0c0c14" />
        </mesh>

        {/* City Hub Markers */}
        {hubs.map((hub, i) => (
          <group key={i} position={hub.pos}>
            <mesh onClick={() => setActiveNode(i)}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshBasicMaterial color={hub.color} />
            </mesh>
            
            {/* Pulse Ring */}
            <mesh scale={i === activeNode ? 2.2 : 1.2}>
              <ringGeometry args={[0.08, 0.12, 16]} />
              <meshBasicMaterial color={hub.color} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>

            {/* Floating Label for Active or Hovered Hub */}
            {(i === activeNode || i === 0) && (
              <Html position={[0, 0.2, 0]} center distanceFactor={8}>
                <div
                  onClick={() => setActiveNode(i)}
                  style={{
                    background: "rgba(13, 14, 20, 0.95)",
                    border: `1px solid ${hub.color}`,
                    borderRadius: "10px",
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "11px",
                    boxShadow: `0 8px 25px rgba(0,0,0,0.6)`,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    direction: dir,
                    textAlign: dir === "rtl" ? "right" : "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: hub.color, flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: hub.color, boxShadow: `0 0 6px ${hub.color}` }} />
                    <span>{hub.name}</span>
                  </div>
                  <div style={{ fontSize: "9.5px", color: "#cbd5e1", marginTop: "2px" }}>{hub.sub}</div>
                </div>
              </Html>
            )}
          </group>
        ))}
      </mesh>
    </group>
  );
}

export default function NeuralNetworkGlobe3D() {
  const { lang, dir } = useLanguage();
  const d = GLOBE_DICT[lang] || GLOBE_DICT.en;

  return (
    <div className="designer-card" style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px", direction: dir }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <span className="designer-badge" style={{ marginBottom: "12px" }}>
          <span className="dot" /> {d.badge}
        </span>
        <h3 style={{ fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
          {d.title1} <span style={{ color: "#00d2ff" }}>{d.title2}</span>
        </h3>
        <p style={{ fontSize: "14.5px", color: "#94a3b8", maxWidth: "640px", margin: "0 auto", lineHeight: 1.6 }}>
          {d.subtitle}
        </p>
      </div>

      <div style={{ width: "100%", height: "450px", position: "relative", cursor: "grab" }}>
        <Canvas dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0, 6.5]} fov={45} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 10]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} color="#6366f1" intensity={2} />
          <pointLight position={[10, -10, 10]} color="#00d2ff" intensity={2} />
          <WireGlobe d={d} dir={dir} />
          <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} />
        </Canvas>
      </div>

      <div style={{ textAlign: "center", marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" }}>
        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#34d399", marginBottom: "4px" }}>
          {d.footerStat}
        </div>
        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
          {d.tip}
        </div>
      </div>
    </div>
  );
}
