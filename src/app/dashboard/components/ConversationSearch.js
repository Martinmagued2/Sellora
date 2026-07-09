"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

/**
 * ConversationSearch — in-thread search bar that highlights matching
 * messages and lets you jump between results with up/down arrows.
 *
 * Props:
 *   messages: array of message objects ({ id, content, created_at, is_ai, direction })
 *   onJumpTo: (messageId) => void — scroll to the message
 *
 * Renders a search bar that slides down from the top of the chat area.
 */
export default function ConversationSearch({ messages = [], onJumpTo, isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery("");
      setCurrentIdx(0);
    }
  }, [isOpen]);

  // Filter matching messages
  const matches = useMemo(() => {
    if (!query.trim() || !messages.length) return [];
    const q = query.toLowerCase();
    return messages.filter(m => {
      const content = (m.content || "").toLowerCase();
      return content.includes(q);
    });
  }, [query, messages]);

  const handleNext = () => {
    if (matches.length === 0) return;
    const next = (currentIdx + 1) % matches.length;
    setCurrentIdx(next);
    onJumpTo?.(matches[next].id);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prev = (currentIdx - 1 + matches.length) % matches.length;
    setCurrentIdx(prev);
    onJumpTo?.(matches[prev].id);
  };

  // Jump to first match on query change
  useEffect(() => {
    if (matches.length > 0) {
      setCurrentIdx(0);
      onJumpTo?.(matches[0].id);
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px",
      background: "var(--bg-secondary, #21222C)",
      borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
      animation: "search-slide-down 0.2s ease",
    }}>
      <style>{`
        @keyframes search-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Search size={14} color="var(--text-tertiary)" />

      <input
        ref={inputRef}
        type="text"
        placeholder="Search in conversation..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? handlePrev() : handleNext(); }
          if (e.key === "Escape") onClose?.();
        }}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
        }}
      />

      {/* Result count */}
      {query.trim() && (
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
          {matches.length > 0 ? `${currentIdx + 1}/${matches.length}` : "No results"}
        </span>
      )}

      {/* Navigation */}
      {matches.length > 0 && (
        <>
          <button onClick={handlePrev} title="Previous (Shift+Enter)" style={navBtnStyle}>
            <ChevronUp size={14} />
          </button>
          <button onClick={handleNext} title="Next (Enter)" style={navBtnStyle}>
            <ChevronDown size={14} />
          </button>
        </>
      )}

      <button onClick={onClose} title="Close (Esc)" style={navBtnStyle}>
        <X size={14} />
      </button>
    </div>
  );
}

const navBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-tertiary)", cursor: "pointer", padding: 4,
  display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 4, transition: "all 0.15s ease",
};
