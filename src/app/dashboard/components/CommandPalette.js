"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, MessageCircle, ShoppingBag, Package,
  Users, Megaphone, Target, Tag, BarChart3, Webhook, Bot, Sparkles,
  FlaskConical, Star, Smartphone, Store, Truck, Settings, CreditCard,
  ShoppingCart, Bell, Gift, Zap, FileText, ArrowRight, CornerDownLeft,
} from "lucide-react";

const COMMANDS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", section: "Navigation" },
  { label: "Conversations", icon: MessageCircle, path: "/dashboard/conversations", section: "Navigation" },
  { label: "Orders", icon: ShoppingBag, path: "/dashboard/orders", section: "Navigation" },
  { label: "Products", icon: Package, path: "/dashboard/products", section: "Navigation" },
  { label: "Customers", icon: Users, path: "/dashboard/customers", section: "Navigation" },
  { label: "Abandoned Carts", icon: ShoppingCart, path: "/dashboard/abandoned-carts", section: "Navigation" },
  { label: "Notifications", icon: Bell, path: "/dashboard/notifications", section: "Navigation" },
  { label: "Referrals", icon: Gift, path: "/dashboard/referrals", section: "Navigation" },
  { label: "Campaigns", icon: Megaphone, path: "/dashboard/campaigns", section: "Manage" },
  { label: "Segments", icon: Target, path: "/dashboard/segments", section: "Manage" },
  { label: "Coupons", icon: Tag, path: "/dashboard/coupons", section: "Manage" },
  { label: "Analytics", icon: BarChart3, path: "/dashboard/analytics", section: "Manage" },
  { label: "Webhooks", icon: Webhook, path: "/dashboard/webhooks", section: "Manage" },
  { label: "Automation", icon: Bot, path: "/dashboard/automation", section: "Manage" },
  { label: "Flow Builder", icon: Zap, path: "/dashboard/flows", section: "Manage" },
  { label: "AI Personality", icon: Sparkles, path: "/dashboard/ai-personality", section: "Manage" },
  { label: "A/B Tests", icon: FlaskConical, path: "/dashboard/ab-tests", section: "Manage" },
  { label: "Reviews", icon: Star, path: "/dashboard/reviews", section: "Manage" },
  { label: "WA Catalog", icon: Smartphone, path: "/dashboard/whatsapp-catalog", section: "Manage" },
  { label: "Stores", icon: Store, path: "/dashboard/stores", section: "Manage" },
  { label: "Shipping", icon: Truck, path: "/dashboard/shipping", section: "Manage" },
  { label: "Settings", icon: Settings, path: "/dashboard/settings", section: "Settings" },
  { label: "Billing", icon: CreditCard, path: "/dashboard/billing", section: "Settings" },
  { label: "Help Center", icon: FileText, path: "/help", section: "Settings" },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  const filtered = COMMANDS.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q);
  });

  // Group by section
  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {});

  const flatFiltered = filtered;

  const handleSelect = (cmd) => {
    router.push(cmd.path);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatFiltered[activeIndex]) handleSelect(flatFiltered[activeIndex]);
    }
  };

  if (!isOpen) return null;

  let runningIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          zIndex: 9998,
        }}
      />
      {/* Palette */}
      <div
        style={{
          position: "fixed",
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: 560,
          background: "var(--bg-secondary, #21222C)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          zIndex: 9999,
          overflow: "hidden",
          animation: "cmd-palette-in 0.15s ease",
        }}
        onKeyDown={handleKeyDown}
      >
        <style>{`
          @keyframes cmd-palette-in {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.98); }
            to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          }
        `}</style>

        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Search size={20} color="rgba(255,255,255,0.4)" />
          <input
            type="text"
            placeholder="Search pages, settings, actions..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 16,
              fontFamily: "inherit",
            }}
          />
          <kbd style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11,
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto", padding: 8 }}>
          {flatFiltered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
              No results found for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([section, cmds]) => (
              <div key={section} style={{ marginBottom: 4 }}>
                <div style={{
                  padding: "6px 12px", fontSize: 10, fontWeight: 700,
                  color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1,
                }}>
                  {section}
                </div>
                {cmds.map(cmd => {
                  runningIndex++;
                  const isActive = runningIndex === activeIndex;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.path}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        width: "100%", padding: "10px 12px",
                        background: isActive ? "rgba(88,101,242,0.15)" : "transparent",
                        border: "none", borderRadius: 8,
                        cursor: "pointer", textAlign: "left",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                        transition: "all 0.1s ease",
                      }}
                    >
                      <Icon size={16} color={isActive ? "#7E88F5" : "rgba(255,255,255,0.4)"} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{cmd.label}</span>
                      {isActive && <CornerDownLeft size={14} color="rgba(255,255,255,0.3)" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11, color: "rgba(255,255,255,0.3)",
        }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>Sellora Command Palette</span>
        </div>
      </div>
    </>
  );
}
