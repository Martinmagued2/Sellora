"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package, Megaphone, Tag, Send, X } from "lucide-react";

/**
 * QuickActionsFAB — floating action button that opens a menu of
 * the most common actions. Fixed at bottom-left (opposite the
 * copilot FAB which is bottom-right on desktop).
 */
export default function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const actions = [
    { label: "New Product", icon: Package, path: "/dashboard/products", color: "#5865F2" },
    { label: "New Campaign", icon: Megaphone, path: "/dashboard/campaigns", color: "#EB459E" },
    { label: "New Coupon", icon: Tag, path: "/dashboard/coupons", color: "#F8A532" },
    { label: "Send Broadcast", icon: Send, path: "/dashboard/automation", color: "#00D2FF" },
  ];

  return (
    <div ref={ref} style={{ position: "fixed", bottom: 24, left: 24, zIndex: 900 }}>
      {/* Action menu */}
      {isOpen && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          marginBottom: 12, animation: "fab-slide-up 0.2s ease",
        }}>
          <style>{`
            @keyframes fab-slide-up {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={() => { router.push(action.path); setIsOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px", borderRadius: 12,
                  background: "var(--bg-secondary, #21222C)",
                  border: "1px solid var(--border-medium, rgba(255,255,255,0.08))",
                  color: "var(--text-primary, #fff)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color + "40";
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-medium, rgba(255,255,255,0.08))";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: action.color + "15",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} color={action.color} />
                </div>
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #5865F2, #00D2FF)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(88, 101, 242, 0.4)",
          transition: "transform 0.2s ease",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
        }}
        title="Quick Actions"
      >
        {isOpen ? <X size={22} color="#fff" /> : <Plus size={22} color="#fff" />}
      </button>
    </div>
  );
}
