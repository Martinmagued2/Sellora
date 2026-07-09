"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

/**
 * MentionInput — textarea with @ mention autocomplete.
 *
 * When the user types `@`, a dropdown appears showing:
 *   - Team Members (from /api/team-members)
 *   - Customers (from /api/customers/search?q=...)
 *
 * On select, inserts `@[Display Name](type:uuid)` into the textarea.
 * This encoded format is:
 *   - Parsed by /api/chat/route.js to inject context for the LLM
 *   - Stripped by CopilotPanel's getMessageText for display
 *
 * Props:
 *   value, onChange — controlled textarea value
 *   placeholder, disabled
 *   onKeyDown — forwarded (for Enter-to-submit handling)
 *   id — forwarded to the textarea element
 */

const MENTION_REGEX = /@\[([^\]]+)\]\((team_member|customer):([a-f0-9-]+)\)/g;
// Used to detect the @ trigger at the cursor position
const TRIGGER_REGEX = /@([^\s@]*)$/;

export default function MentionInput({
  value,
  onChange,
  placeholder,
  disabled,
  onKeyDown,
  id,
  style,
}) {
  const textareaRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [triggerStart, setTriggerStart] = useState(-1);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load team members once on mount (they're a small list, cache forever)
  useEffect(() => {
    setTeamMembersLoading(true);
    fetch("/api/team-members")
      .then((r) => r.json())
      .then((d) => setTeamMembers(d.assignees || []))
      .catch(() => {})
      .finally(() => setTeamMembersLoading(false));
  }, []);

  // Debounced customer search when searchQuery changes
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

  // Build the combined dropdown items
  const items = [];
  for (const m of teamMembers) {
    const name = m.display_name || m.name || m.email;
    if (!name) continue;
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) continue;
    items.push({
      type: "team_member",
      id: m.id,
      display_name: name,
      subtitle: m.role === "owner" ? "Owner" : `Team ${m.role || "member"}`,
      badge: "TEAM",
      badgeColor: "#3b82f6",
    });
  }
  for (const c of customers) {
    items.push({
      type: "customer",
      id: c.id,
      display_name: c.name,
      subtitle: [c.phone, c.email].filter(Boolean).join(" · ") || c.channel || "Customer",
      badge: "CUSTOMER",
      badgeColor: "#10b981",
      total_spent: c.total_spent,
    });
  }
  // Limit dropdown to 8 items
  const visibleItems = items.slice(0, 8);

  // Reset activeIndex when dropdown contents change
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, teamMembers.length, customers.length]);

  // Compute dropdown position based on textarea caret
  const computeDropdownPosition = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Simple positioning: place dropdown right above the textarea, aligned left
    const rect = ta.getBoundingClientRect();
    setDropdownStyle({
      top: rect.top - 8,  // will be translated up by dropdown height via CSS transform
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Handle textarea input — detect @ trigger
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Find @ trigger immediately before the cursor
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const match = textBeforeCursor.match(TRIGGER_REGEX);

    if (match) {
      const query = match[1];
      setSearchQuery(query);
      setShowDropdown(true);
      setTriggerStart(cursorPos - match[0].length);  // position of the @
      computeDropdownPosition();
    } else {
      setShowDropdown(false);
      setTriggerStart(-1);
    }
  };

  // Insert a mention into the textarea at the current trigger position
  const insertMention = (item) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = value.slice(0, triggerStart);
    const after = value.slice(ta.selectionStart);
    const encoded = `@[${item.display_name}](${item.type}:${item.id})`;
    const newValue = `${before}${encoded} ${after}`;
    onChange(newValue);

    // Move cursor to just after the inserted mention + space
    const newCursorPos = (before + encoded + " ").length;
    setShowDropdown(false);
    setTriggerStart(-1);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle keydown for navigation + selection
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
    // Forward other keys (incl. Enter when no dropdown) to parent
    if (onKeyDown) onKeyDown(e);
  };

  // Close dropdown on blur (with small delay to allow click registration)
  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 150);
  };

  // Show dropdown also on focus if there's an active trigger
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

  return (
    <div style={{ position: "relative", flex: 1 }}>
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
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          color: "inherit",
          fontSize: "14px",
          fontFamily: "inherit",
          resize: "none",
          padding: "8px 0",
          maxHeight: "120px",
          ...style,
        }}
      />

      {showDropdown && (
        <div
          style={{
            position: "fixed",
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: dropdownStyle.width,
            maxWidth: "360px",
            transform: "translateY(-100%)",
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border-medium, #e5e7eb)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 9999,
            maxHeight: "280px",
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-tertiary, #6b7280)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid var(--border-light, #f3f4f6)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Search size={11} />
            Mention a team member or customer
          </div>

          {/* Loading state */}
          {teamMembersLoading && (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--text-tertiary, #6b7280)", fontSize: 12 }}>
              <Loader2 size={14} className="spin" style={{ display: "inline-block", marginRight: 6 }} />
              Loading team members…
            </div>
          )}

          {/* Empty state */}
          {!teamMembersLoading && visibleItems.length === 0 && !customersLoading && (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--text-tertiary, #6b7280)", fontSize: 12 }}>
              {searchQuery
                ? `No matches for "${searchQuery}"`
                : "Type @ to search team members and customers"}
            </div>
          )}

          {/* Items list */}
          {visibleItems.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => insertMention(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                background: idx === activeIndex ? "var(--bg-hover, #f9fafb)" : "transparent",
                border: "none",
                borderBottom: "1px solid var(--border-light, #f3f4f6)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-primary, #111)",
                fontSize: 13,
              }}
            >
              {/* Avatar circle with initials */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: item.badgeColor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {item.display_name.charAt(0).toUpperCase()}
              </div>

              {/* Name + subtitle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  @{item.display_name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary, #6b7280)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.subtitle}
                </div>
              </div>

              {/* Badge */}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: item.badgeColor,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {item.badge}
              </span>
            </button>
          ))}

          {/* Footer hint */}
          {visibleItems.length > 0 && (
            <div
              style={{
                padding: "6px 12px",
                fontSize: 10,
                color: "var(--text-tertiary, #9ca3af)",
                borderTop: "1px solid var(--border-light, #f3f4f6)",
                background: "var(--bg-hover, #f9fafb)",
              }}
            >
              ↑↓ to navigate · Enter to select · Esc to close
            </div>
          )}
        </div>
      )}
    </div>
  );
}
