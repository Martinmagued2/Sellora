"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Check, Zap, CreditCard, Send, Sparkles, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";

function GlassAppFrame({ onOrderConfirmed }) {
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
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, x * 0.2, 0.06);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -y * 0.15, 0.06);
  });

  const handleConfirmOrder = () => {
    setOrderCreated(true);
    if (onOrderConfirmed) onOrderConfirmed();
  };

  return (
    <group ref={groupRef}>
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
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, #25D366, #128C7E)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare size={14} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>WhatsApp VIP • Live Inbox</span>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#94A3B8" }}>Customer: Omar Khaled (+20 109 452 811)</div>
                </div>
              </div>
              <span style={{ fontSize: "10px", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "4px 8px", borderRadius: "20px", border: "1px solid rgba(99, 102, 241, 0.3)", fontWeight: 600 }}>
                ⚡ Auto-Pilot Active
              </span>
            </div>

            {/* Chat Body */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "200px" }}>
              {/* Customer Message */}
              <div style={{ alignSelf: "flex-start", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.06)", padding: "10px 14px", borderRadius: "12px", borderTopLeftRadius: "2px", maxWidth: "85%" }}>
                <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#e2e8f0", margin: 0, direction: "rtl" }}>
                  ممكن أعرف سعر الكوتشي المقاس 42 وعنوان فرع اسكندرية وهل في شحن سريع؟
                </p>
                <span style={{ fontSize: "9px", color: "#64748b", marginTop: "4px", display: "block", textAlign: "right" }}>10:14 AM • via WhatsApp Catalog</span>
              </div>

              {/* Typing Indicator */}
              {typing && (
                <div style={{ alignSelf: "flex-end", background: "rgba(99, 102, 241, 0.2)", padding: "8px 14px", borderRadius: "12px", borderTopRightRadius: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "#818cf8" }}>Sellora AI analyzing Shopify catalog & Paymob inventory...</span>
                </div>
              )}

              {/* AI Copilot Reply */}
              {step >= 1 && (
                <div style={{ alignSelf: "flex-end", background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", padding: "12px 14px", borderRadius: "12px", borderTopRightRadius: "2px", maxWidth: "90%", boxShadow: "0 8px 20px rgba(79, 70, 229, 0.3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                    <Sparkles size={11} color="#c7d2fe" />
                    <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#c7d2fe", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Automated Reply • 0.6s</span>
                  </div>
                  <p style={{ fontSize: "12px", lineHeight: 1.5, color: "#fff", margin: 0, direction: "rtl" }}>
                    أهلاً بك يا أستاذ عمر! 👟 السعر 650 ج.م ومقاس 42 متاح في فرع سموحة. الشحن متاح للإسكندرية خلال 24 ساعة!
                  </p>
                  
                  {/* Quick Action Buttons inside Chat */}
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
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
                          }}
                        >
                          <Zap size={12} color="#4f46e5" /> تأكيد الأوردر (+650 ج.م)
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
                          }}
                        >
                          <CreditCard size={12} /> رابط InstaPay
                        </button>
                      </>
                    ) : (
                      <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                        <Check size={14} /> أوردر #1084 تم إنشاؤه بنجاح وإرسال فاتورة فوري!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer status */}
            <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <ShieldCheck size={12} color="#10b981" /> Paymob & Shopify Live Sync
              </span>
              <span>2FA Verified • Zero Human Delay</span>
            </div>
          </div>
        </Html>
      </Float>
    </group>
  );
}

export default function LiveProductHero3D() {
  const [showToast, setShowToast] = useState(false);

  const handleOrderConfirmed = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  return (
    <div style={{ width: "100%", height: "520px", position: "relative" }}>
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
          }}
        >
          <Sparkles size={16} /> ✨ Paymob Checkout Link Auto-Sent • +650 EGP Added to Daily Revenue!
        </div>
      )}

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} color="#6366f1" intensity={2} />
        <pointLight position={[10, -10, 10]} color="#00d2ff" intensity={1.5} />
        <GlassAppFrame onOrderConfirmed={handleOrderConfirmed} />
      </Canvas>
    </div>
  );
}
