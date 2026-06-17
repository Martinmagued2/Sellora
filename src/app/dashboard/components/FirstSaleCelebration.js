"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, X, Sparkles } from "lucide-react";

/**
 * FirstSaleCelebration — shows confetti + toast when the merchant
 * makes their first sale. Auto-checks on dashboard mount.
 *
 * Renders null if no first sale or already celebrated.
 */
export default function FirstSaleCelebration() {
  const [show, setShow] = useState(false);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    // Delay the check so it doesn't block initial render
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/first-sale");
        if (!res.ok) return;
        const data = await res.json();
        if (data.isFirstSale && data.order) {
          setOrder(data.order);
          setShow(true);
        }
      } catch (e) {
        // Silent fail — don't bother the user
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          maxWidth: 440,
          width: "calc(100% - 32px)",
          background: "linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))",
          border: "1px solid var(--accent-primary)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 80px rgba(88, 101, 242, 0.3)",
          textAlign: "center",
        }}
      >
        {/* Backdrop */}
        <div
          onClick={() => setShow(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            zIndex: -1,
          }}
        />

        <button
          onClick={() => setShow(false)}
          style={{
            position: "absolute",
            top: 12, right: 12,
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>

        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6, repeat: 2 }}
          style={{
            width: 80, height: 80,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #5865F2, #00D2FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(88, 101, 242, 0.5)",
          }}
        >
          <PartyPopper size={40} color="#fff" />
        </motion.div>

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px 0" }}>
          Your first sale! 🎉
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5, margin: "0 0 20px 0" }}>
          You just received your first paid order — congrats! This is the start of something great.
        </p>

        {order && (
          <div style={{
            padding: 14,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
            marginBottom: 20,
            border: "1px solid var(--border-subtle)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>Order</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{order.order_number}</div>
            <div style={{
              fontSize: 22, fontWeight: 800, marginTop: 6,
              background: "linear-gradient(135deg, #3BA55C, #5865F2)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {order.currency} {order.total}
            </div>
          </div>
        )}

        <button
          onClick={() => setShow(false)}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #5865F2, #00D2FF)",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 24px rgba(88, 101, 242, 0.4)",
          }}
        >
          <Sparkles size={14} /> Let's go!
        </button>

        {/* Confetti particles */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: 0, y: 0,
              opacity: 1,
              scale: 1,
            }}
            animate={{
              x: (Math.random() - 0.5) * 600,
              y: (Math.random() - 0.5) * 600,
              opacity: 0,
              scale: 0.5,
              rotate: Math.random() * 360,
            }}
            transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: 8, height: 8,
              borderRadius: 2,
              background: ["#5865F2", "#00D2FF", "#F8A532", "#3BA55C", "#EB459E"][i % 5],
              pointerEvents: "none",
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
