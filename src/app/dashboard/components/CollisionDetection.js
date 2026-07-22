"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * useCollisionDetection — hook that detects when team members are typing
 * in the same conversation, preventing duplicate replies.
 *
 * Wires up the existing /api/conversations/[id]/typing endpoint + the
 * typing_indicators table via Supabase realtime.
 *
 * Usage:
 *   const { otherTypers, broadcastTyping } = useCollisionDetection(conversationId, currentUser);
 *   // Show "John is typing..." when otherTypers.length > 0
 *   // Call broadcastTyping(true/false) when the user starts/stops typing
 *
 * @param {string} conversationId
 * @param {{id: string, name?: string}} currentUser
 */
export function useCollisionDetection(conversationId, currentUser) {
  const [otherTypers, setOtherTypers] = useState([]);  // [{user_id, name, created_at}]
  const [customerTyping, setCustomerTyping] = useState(false);
  const lastBroadcastRef = useRef(0);
  const debounceRef = useRef(null);

  // Subscribe to typing_indicators changes via Supabase realtime
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Fetch fresh typers on any change
          fetchTypers();
        }
      )
      .subscribe();

    // Also poll every 3 seconds as a fallback (realtime can miss events)
    const pollInterval = setInterval(fetchTypers, 3000);

    async function fetchTypers() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/typing`);
        if (!res.ok) return;
        const data = await res.json();

        // Filter out the current user from "other typers"
        const others = (data.typers || []).filter((t) => {
          if (t.is_customer) return false;  // customer typing is separate
          // The typing endpoint stores user_id but doesn't return it in GET.
          // We rely on is_team_member + exclude "self" by checking if anyone
          // is typing. Since we only show OTHER team members, and the current
          // user's own typing indicator is also in the table, we need to
          // distinguish. For now, we show the count minus 1 if the current
          // user is also typing.
          return true;
        });

        // If the current user is also typing, subtract them from the count
        // (The endpoint doesn't return user_id, so we approximate by checking
        //  if we broadcasted typing recently.)
        const recentBroadcast = Date.now() - lastBroadcastRef.current < 5000;
        if (recentBroadcast && others.length > 0) {
          // Assume one of them is us
          setOtherTypers(others.slice(1));  // remove "us"
        } else {
          setOtherTypers(others);
        }
        setCustomerTyping(data.customerTyping || false);
      } catch (e) {
        // Silent fail — collision detection is best-effort
      }
    }

    // Initial fetch
    fetchTypers();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      // Clean up: broadcast that we stopped typing when unmounting
      if (Date.now() - lastBroadcastRef.current < 5000) {
        broadcastTyping(false);
      }
    };
  }, [conversationId]);

  /**
   * Broadcast typing status. Debounced to avoid spamming the API.
   */
  const broadcastTyping = useCallback((isTyping) => {
    if (!conversationId || !currentUser?.id) return;

    // Debounce: don't broadcast more than once per 2 seconds
    const now = Date.now();
    if (isTyping && now - lastBroadcastRef.current < 2000) return;
    lastBroadcastRef.current = isTyping ? now : 0;

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Set a "stop typing" timer — if the user doesn't type again within 4s,
    // auto-broadcast stop.
    if (isTyping) {
      debounceRef.current = setTimeout(() => {
        lastBroadcastRef.current = 0;
        fetch(`/api/conversations/${conversationId}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isTyping: false }),
        }).catch(() => {});
      }, 4000);
    }

    fetch(`/api/conversations/${conversationId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTyping }),
    }).catch(() => {});
  }, [conversationId, currentUser?.id]);

  return { otherTypers, customerTyping, broadcastTyping };
}

/**
 * CollisionBanner — renders "John is typing..." / "2 team members are replying..."
 *
 * Props:
 *   otherTypers: array from useCollisionDetection
 *   customerTyping: boolean from useCollisionDetection
 *   teamMembers: array of {id, name} for resolving typer names
 */
export function CollisionBanner({ otherTypers = [], customerTyping = false, teamMembers = [] }) {
  if (otherTypers.length === 0 && !customerTyping) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      marginBottom: 6,
      fontSize: 12,
      color: "var(--text-secondary)",
      background: "var(--bg-hover, rgba(108, 92, 231, 0.05))",
      borderRadius: 8,
      border: "1px solid var(--border-subtle)",
    }}>
      {customerTyping && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", gap: 2 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-tertiary)", animation: "blink 1.4s infinite" }} />
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-tertiary)", animation: "blink 1.4s infinite 0.2s" }} />
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-tertiary)", animation: "blink 1.4s infinite 0.4s" }} />
          </span>
          <span style={{ fontStyle: "italic" }}>Customer is typing...</span>
        </span>
      )}

      {otherTypers.length > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#6c5ce7",
            boxShadow: "0 0 6px #6c5ce7",
          }} />
          {otherTypers.length === 1
            ? "A team member is replying..."
            : `${otherTypers.length} team members are replying...`
          }
          <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            (avoid duplicate replies)
          </span>
        </span>
      )}

      <style>{`
        @keyframes blink {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
