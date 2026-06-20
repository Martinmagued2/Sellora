"use client";

import { useEffect } from "react";

/**
 * Keyboard shortcuts for the conversations page.
 *
 * J / ArrowDown  — next conversation
 * K / ArrowUp    — previous conversation
 * R              — focus reply composer
 * E              — mark as resolved (close conversation)
 * A              — open assign menu
 * P              — pause/resume AI
 * /              — focus search
 * Esc            — close any open menu/modal
 *
 * Usage:
 *   <ConversationShortcuts
 *     onNext={...}
 *     onPrev={...}
 *     onReplyFocus={...}
 *     onResolve={...}
 *     onAssign={...}
 *     onToggleAi={...}
 *     onSearchFocus={...}
 *   />
 */
export default function ConversationShortcuts({
  onNext, onPrev, onReplyFocus, onResolve, onAssign,
  onToggleAi, onSearchFocus, onEscape,
}) {
  useEffect(() => {
    const handler = (e) => {
      // Don't intercept when typing in an input/textarea
      const tag = e.target.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;

      // Escape always works
      if (e.key === "Escape") {
        if (onEscape) onEscape();
        return;
      }

      // "/" focuses search even when typing (but only if not already in search)
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        onSearchFocus?.();
        return;
      }

      if (isTyping) return;

      // Single-key shortcuts (no modifier)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
          e.preventDefault();
          onNext?.();
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          onPrev?.();
          break;
        case "r":
          e.preventDefault();
          onReplyFocus?.();
          break;
        case "e":
          e.preventDefault();
          onResolve?.();
          break;
        case "a":
          e.preventDefault();
          onAssign?.();
          break;
        case "p":
          e.preventDefault();
          onToggleAi?.();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onReplyFocus, onResolve, onAssign, onToggleAi, onSearchFocus, onEscape]);

  return null;
}
