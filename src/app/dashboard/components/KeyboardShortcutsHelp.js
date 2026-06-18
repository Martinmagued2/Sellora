"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open command palette", category: "Global" },
  { keys: ["?"], description: "Show this shortcuts help", category: "Global" },
  { keys: ["Esc"], description: "Close any modal / menu", category: "Global" },
  { keys: ["J"], description: "Next conversation", category: "Conversations" },
  { keys: ["K"], description: "Previous conversation", category: "Conversations" },
  { keys: ["R"], description: "Focus reply composer", category: "Conversations" },
  { keys: ["E"], description: "Resolve / close conversation", category: "Conversations" },
  { keys: ["P"], description: "Pause / resume AI", category: "Conversations" },
  { keys: ["A"], description: "Open assignment menu", category: "Conversations" },
  { keys: ["/"], description: "Focus search bar", category: "Navigation" },
];

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Press ? to open
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Esc to close
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!isOpen) return null;

  // Group by category
  const grouped = SHORTCUTS.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          zIndex: 9998,
        }}
      />
      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%", maxWidth: 480,
        background: "var(--bg-secondary, #21222C)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: 28,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        zIndex: 9999,
        maxHeight: "80vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Keyboard size={20} color="#7E88F5" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts grouped by category */}
        {Object.entries(grouped).map(([category, shortcuts]) => (
          <div key={category} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              {category}
            </div>
            {shortcuts.map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 0", borderBottom: i < shortcuts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.description}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {s.keys.map((key, j) => (
                    <kbd key={j} style={{
                      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: "rgba(255,255,255,0.06)", color: "var(--text-primary)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontFamily: "monospace",
                    }}>
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          marginTop: 16, paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
          fontSize: 11, color: "var(--text-tertiary)",
        }}>
          Press <kbd style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", fontFamily: "monospace" }}>?</kbd> anytime to open this help
        </div>
      </div>
    </>
  );
}
