"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, AtSign, X } from "lucide-react";

/**
 * MentionInput — textarea with @ mention autocomplete.
 *
 * When the user types `@` (or clicks the @ button), a dropdown appears
 * showing:
 *   - Team Members  (blue badge)
 *   - Customers     (green badge)
 *
 * On select, inserts `@[Display Name](type:uuid)` into the textarea.
 * This encoded format is:
 *   - Parsed by /api/chat/route.js to inject context for the LLM
 *   - Stripped by CopilotPanel's getMessageText for display
 *
 * IMPORTANT: All dropdown colors are HARDCODED (not CSS variables) so the
 * dropdown is always visible regardless of light/dark theme.
 */

const TRIGGER_REGEX = /@([^\s@]*)$/;

export default function MentionInput({
  value,
  onChange,
  placeholder,
  disabled,
  onKeyDown,
  id,
}) {
  const textareaRef = useRef(null);
  const wrapperRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [triggerStart, setTriggerStart] = useState(-1);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [teamMembersError, setTeamMembersError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load team members once on mount
  useEffect(() => {
    setTeamMembersLoading(true);
    setTeamMembersError(null);
    fetch("/api/team-members")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setTeamMembers(d.assignees || []);
      })
      .catch((err) => {
        setTeamMembersError(err.message);
      })
      .finally(() => setTeamMembersLoading(false));
  }, []);

  // Debounced customer search
  useEffect(() => {
    if (searchQuery.length < 1) {
      setCustomers([]);
      return;
    }
    setCustomersLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setCustomers(d.customers || []))
        .catch(() => setCustomers([]))
        .finally(() => setCustomersLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Build the combined dropdown items, grouped by type
  const teamItems = [];
  for (const m of teamMembers) {
    const name = m.display_name || m.name || m.email;
    if (!name) continue;
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) continue;
    teamItems.push({
      type: "team_member",
      id: m.id,
      display_name: name,
      subtitle: m.role === "owner" ? "Owner" : `Team ${m.role || "member"}`,
    });
  }

  const customerItems = [];
  for (const c of customers) {
    customerItems.push({
      type: "customer",
      id: c.id,
      display_name: c.name,
      subtitle: [c.phone, c.email].filter(Boolean).join(" · ") || c.channel || "Customer",
      total_spent: c.total_spent,
    });
  }

  // Combined flat list for keyboard navigation
  const allItems = [...teamItems, ...customerItems];
  const visibleItems = allItems.slice(0, 8);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, teamMembers.length, customers.length]);

  // Compute dropdown position relative to the textarea
  const computeDropdownPosition = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    setDropdownPos({
      top: rect.top,
      left: rect.left,
      width: Math.max(rect.width, 320),
    });
  }, []);

  // Open the dropdown at the current cursor position
  const openDropdownAtCursor = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(TRIGGER_REGEX);
    if (match) {
      setSearchQuery(match[1]);
      setTriggerStart(cursorPos - match[0].length);
    } else {
      setSearchQuery("");
      setTriggerStart(cursorPos);
    }
    computeDropdownPosition();
    setShowDropdown(true);
  };

  // Handle textarea input
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    const textBeforeCursor = newValue.slice(0, cursorPos);
    const match = textBeforeCursor.match(TRIGGER_REGEX);

    if (match) {
      setSearchQuery(match[1]);
      setShowDropdown(true);
      setTriggerStart(cursorPos - match[0].length);
      computeDropdownPosition();
    } else {
      // If user typed @ but nothing after, the regex above still matches with empty group
      // Only close if there's no @ at all before cursor
      const lastChar = textBeforeCursor.slice(-1);
      if (lastChar !== "@") {
        // Check if we're still inside a @trigger (e.g., "@Jo")
        // The regex already handles this, so if no match, close
        setShowDropdown(false);
        setTriggerStart(-1);
      }
    }
  };

  // Click the @ button — insert an @ at cursor and open dropdown
  const handleAtButtonClick = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    // Insert @ — if there's a space before cursor, just add @; otherwise add space + @
    const needSpace = before.length > 0 && !before.endsWith(" ");
    const insert = needSpace ? " @" : "@";
    const newValue = before + insert + after;
    const newCursorPos = before.length + insert.length;
    onChange(newValue);
    setTriggerStart(newCursorPos - 1);  // position of the @
    setSearchQuery("");
    computeDropdownPosition();
    setShowDropdown(true);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Insert a mention
  const insertMention = (item) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    // If triggerStart is valid, replace from there; otherwise replace the @query at cursor
    const start = triggerStart >= 0 ? triggerStart : cursorPos;
    const before = value.slice(0, start);
    const after = value.slice(cursorPos);
    const encoded = `@[${item.display_name}](${item.type}:${item.id})`;
    const newValue = `${before}${encoded} ${after}`;
    onChange(newValue);

    const newCursorPos = (before + encoded + " ").length;
    setShowDropdown(false);
    setTriggerStart(-1);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle keydown
  const handleKeyDown = (e) => {
    if (showDropdown && visibleItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % visibleItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(visibleItems[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 200);
  };

  const handleFocus = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(TRIGGER_REGEX);
    if (match) {
      setSearchQuery(match[1]);
      setShowDropdown(true);
      setTriggerStart(cursorPos - match[0].length);
      computeDropdownPosition();
    }
  };

  // Determine if the dropdown should show even with empty query (yes, show team members)
  const showTeamSection = !teamMembersLoading && teamItems.length > 0;
  const showCustomerSection = searchQuery.length > 0 && !customersLoading && customerItems.length > 0;
  const showNoResults =
    !teamMembersLoading &&
    !customersLoading &&
    teamItems.length === 0 &&
    customerItems.length === 0 &&
    searchQuery.length > 0;

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="copilot-mention-textarea"
          style={{
            width: "100%",
            // NOTE: Do NOT set background/border/color here — let CSS handle it.
            // Inline styles override CSS which made the textarea invisible.
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            fontSize: "14.5px",
            lineHeight: "1.4",
            padding: "14px 18px",
            minHeight: "50px",
            maxHeight: "120px",
          }}
        />

        {/* @ button — visible always, gives users a clear way to trigger mentions */}
        <button
          type="button"
          onClick={handleAtButtonClick}
          disabled={disabled}
          title="Mention a team member or customer"
          className="mention-trigger-btn"
          style={{
            position: "absolute",
            right: 8,
            bottom: 10,
            width: 32,
            height: 32,
            border: "none",
            borderRadius: "50%",
            background: showDropdown
              ? "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)"
              : "rgba(108, 92, 231, 0.15)",
            color: showDropdown ? "#fff" : "#6c5ce7",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            zIndex: 2,
          }}
        >
          <AtSign size={16} />
        </button>
      </div>

      {/* Dropdown — rendered with fixed positioning, ALWAYS visible colors */}
      {showDropdown && (
        <div
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: Math.max(dropdownPos.width, 340),
            maxWidth: "90vw",
            transform: "translateY(-100%)",
            background: "#ffffff",           // HARDCODED white — always visible
            border: "2px solid #6c5ce7",     // purple border — stands out
            borderRadius: "12px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            zIndex: 999999,                  // very high to ensure above everything
            maxHeight: "360px",
            overflowY: "auto",
            color: "#111111",                // dark text on white bg
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#6c5ce7",
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#faf9ff",
              borderRadius: "10px 10px 0 0",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AtSign size={13} />
              Mention someone
            </span>
            <button
              type="button"
              onClick={() => setShowDropdown(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#999",
                padding: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Loading state */}
          {teamMembersLoading && (
            <div style={{ padding: "20px", textAlign: "center", color: "#666", fontSize: 13 }}>
              <Loader2 size={18} className="spin" style={{ display: "inline-block", marginRight: 8 }} />
              Loading team members…
            </div>
          )}

          {/* Error state */}
          {teamMembersError && !teamMembersLoading && (
            <div style={{ padding: "12px 14px", color: "#dc2626", fontSize: 12, background: "#fef2f2" }}>
              Failed to load team members: {teamMembersError}
            </div>
          )}

          {/* TEAM MEMBERS section */}
          {showTeamSection && (
            <>
              <div
                style={{
                  padding: "6px 14px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  background: "#eff6ff",
                  borderBottom: "1px solid #dbeafe",
                }}
              >
                📘 Team Members ({teamItems.length})
              </div>
              {teamItems.map((item, idx) => {
                const flatIdx = idx;  // team items come first in the flat list
                return (
                  <MentionItem
                    key={`team-${item.id}`}
                    item={item}
                    isActive={flatIdx === activeIndex}
                    onClick={() => insertMention(item)}
                    onHover={() => setActiveIndex(flatIdx)}
                    color="#3b82f6"
                    badge="TEAM"
                    icon="📘"
                  />
                );
              })}
            </>
          )}

          {/* CUSTOMERS section */}
          {showCustomerSection && (
            <>
              <div
                style={{
                  padding: "6px 14px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#10b981",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  background: "#ecfdf5",
                  borderBottom: "1px solid #d1fae5",
                  borderTop: teamItems.length > 0 ? "1px solid #e5e7eb" : "none",
                }}
              >
                📗 Customers ({customerItems.length})
              </div>
              {customerItems.map((item, idx) => {
                const flatIdx = teamItems.length + idx;
                return (
                  <MentionItem
                    key={`customer-${item.id}`}
                    item={item}
                    isActive={flatIdx === activeIndex}
                    onClick={() => insertMention(item)}
                    onHover={() => setActiveIndex(flatIdx)}
                    color="#10b981"
                    badge="CUSTOMER"
                    icon="📗"
                  />
                );
              })}
            </>
          )}

          {/* Customer loading indicator */}
          {customersLoading && searchQuery.length > 0 && (
            <div style={{ padding: "10px 14px", color: "#666", fontSize: 12 }}>
              <Loader2 size={12} className="spin" style={{ display: "inline-block", marginRight: 6 }} />
              Searching customers for "{searchQuery}"…
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <div style={{ padding: "20px", textAlign: "center", color: "#666", fontSize: 13 }}>
              No matches found for "{searchQuery}"
            </div>
          )}

          {/* Empty hint (no search query, no team members loaded yet) */}
          {!teamMembersLoading && !teamMembersError && teamItems.length === 0 && searchQuery.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "#666", fontSize: 13 }}>
              No team members found. Try typing a customer name to search customers.
            </div>
          )}

          {/* Footer hint */}
          {visibleItems.length > 0 && (
            <div
              style={{
                padding: "8px 14px",
                fontSize: "10px",
                color: "#999",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                borderRadius: "0 0 10px 10px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>↑↓ navigate · Enter select · Esc close</span>
              <span style={{ fontWeight: 600 }}>Type to filter</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Individual mention item — extracted for clarity.
 * Colors are HARDCODED to ensure visibility in both light and dark themes.
 */
function MentionItem({ item, isActive, onClick, onHover, color, badge, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: isActive ? "#f3f4f6" : "#ffffff",
        border: "none",
        borderBottom: "1px solid #f0f0f0",
        cursor: "pointer",
        textAlign: "left",
        color: "#111111",
        fontSize: 14,
        transition: "background 0.1s ease",
      }}
    >
      {/* Avatar circle with colored background + initial */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: color,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: "0 2px 6px " + color + "55",
        }}
      >
        {item.display_name.charAt(0).toUpperCase()}
      </div>

      {/* Name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "#111111",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.display_name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#666666",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 2,
          }}
        >
          {item.subtitle}
        </div>
      </div>

      {/* Type badge — big and clearly colored */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.6px",
          padding: "4px 10px",
          borderRadius: "6px",
          background: color,
          color: "#ffffff",
          flexShrink: 0,
          minWidth: "70px",
          textAlign: "center",
        }}
      >
        {badge}
      </span>
    </button>
  );
}
