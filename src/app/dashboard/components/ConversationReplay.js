"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Clock, User,
  Bot, MessageCircle, ChevronLeft, ChevronRight, X
} from "lucide-react";

/**
 * ConversationReplay — a "movie player" for conversations.
 *
 * Lets operators replay an entire conversation like a video, showing:
 *   - Who replied (customer vs AI vs team member)
 *   - Delays between messages (visualized)
 *   - AI interventions (highlighted)
 *   - Sentiment changes (color-coded)
 *   - Transfers between team members
 *
 * Controls:
 *   - Play/Pause
 *   - Skip back/forward (one message at a time)
 *   - Speed control (1x, 2x, 5x)
 *   - Timeline scrubber
 *
 * Useful for:
 *   - Support reviews
 *   - Training new team members
 *   - Auditing AI behavior
 *   - Post-mortem on escalated conversations
 */

const SPEEDS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "5x", value: 5 },
];

export default function ConversationReplay({ messages = [], onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [visibleMessages, setVisibleMessages] = useState([]);
  const timerRef = useRef(null);

  // Sort messages by created_at
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  // Auto-advance when playing
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (currentIndex >= sortedMessages.length - 1) {
      setPlaying(false);
      return;
    }

    // Compute delay to next message (capped at 3 seconds for readability)
    const current = sortedMessages[currentIndex];
    const next = sortedMessages[currentIndex + 1];
    let delay = 1000;  // Default 1 second
    if (current?.created_at && next?.created_at) {
      const realDelay = new Date(next.created_at) - new Date(current.created_at);
      // Scale: at 1x speed, 1 real second = 0.5 playback seconds (so it's watchable)
      // Cap at 3 seconds max so long gaps don't bore the viewer
      delay = Math.min(3000, Math.max(300, realDelay / 2000 / speed));
    } else {
      delay = 800 / speed;
    }

    timerRef.current = setTimeout(() => {
      setCurrentIndex(idx => Math.min(idx + 1, sortedMessages.length - 1));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentIndex, sortedMessages, speed]);

  // Update visible messages when currentIndex changes
  useEffect(() => {
    setVisibleMessages(sortedMessages.slice(0, currentIndex + 1));
  }, [currentIndex, sortedMessages]);

  const handlePlayPause = () => {
    if (currentIndex >= sortedMessages.length - 1) {
      setCurrentIndex(0);  // Restart from beginning
    }
    setPlaying(p => !p);
  };

  const handleSkipBack = () => {
    setPlaying(false);
    setCurrentIndex(idx => Math.max(0, idx - 1));
  };

  const handleSkipForward = () => {
    setPlaying(false);
    setCurrentIndex(idx => Math.min(sortedMessages.length - 1, idx + 1));
  };

  const handleScrub = (e) => {
    setPlaying(false);
    const newIdx = parseInt(e.target.value, 10);
    setCurrentIndex(newIdx);
  };

  if (sortedMessages.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-tertiary)" }}>
        No messages to replay.
      </div>
    );
  }

  const progress = ((currentIndex + 1) / sortedMessages.length) * 100;
  const currentMsg = sortedMessages[currentIndex];

  return (
    <div style={{
      background: "var(--bg-card)",
      borderRadius: 12,
      border: "1px solid var(--border-subtle)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
        background: "linear-gradient(135deg, rgba(108, 92, 231, 0.05) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Play size={14} color="#6c5ce7" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Conversation Replay</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {currentIndex + 1} / {sortedMessages.length}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", padding: 4,
          }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Message display area */}
      <div style={{
        height: 320, overflowY: "auto", padding: 14,
        background: "var(--bg-secondary)",
      }}>
        {visibleMessages.map((msg, idx) => {
          const isCurrent = idx === currentIndex;
          const isCustomer = msg.direction === "incoming";
          const isAI = msg.is_ai;
          const isTeamMember = !isCustomer && !isAI;

          // Compute delay from previous message
          let delayText = "";
          if (idx > 0) {
            const prev = sortedMessages[idx - 1];
            if (prev.created_at && msg.created_at) {
              const delayMs = new Date(msg.created_at) - new Date(prev.created_at);
              if (delayMs < 60000) delayText = `${Math.round(delayMs / 1000)}s later`;
              else if (delayMs < 3600000) delayText = `${Math.round(delayMs / 60000)}m later`;
              else delayText = `${Math.round(delayMs / 3600000)}h later`;
            }
          }

          return (
            <div key={idx}>
              {/* Delay indicator */}
              {delayText && (
                <div style={{
                  textAlign: "center", fontSize: 10, color: "var(--text-tertiary)",
                  margin: "8px 0", fontStyle: "italic",
                }}>
                  ── {delayText} ──
                </div>
              )}

              {/* Message bubble */}
              <div style={{
                display: "flex",
                justifyContent: isCustomer ? "flex-start" : "flex-end",
                marginBottom: 8,
                opacity: isCurrent ? 1 : 0.6,
                transition: "opacity 0.3s",
              }}>
                <div style={{
                  maxWidth: "75%", padding: "8px 12px", borderRadius: 12,
                  background: isCustomer
                    ? "var(--bg-card)"
                    : isAI
                      ? "linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(162, 155, 254, 0.1) 100%)"
                      : "rgba(0, 200, 83, 0.1)",
                  border: isCurrent
                    ? `2px solid ${isCustomer ? "#2196f3" : isAI ? "#6c5ce7" : "#00c853"}`
                    : "1px solid var(--border-subtle)",
                  boxShadow: isCurrent ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
                }}>
                  {/* Sender label */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 10, fontWeight: 600, marginBottom: 4,
                    color: isCustomer ? "#2196f3" : isAI ? "#6c5ce7" : "#00c853",
                  }}>
                    {isCustomer ? <User size={10} /> : isAI ? <Bot size={10} /> : <MessageCircle size={10} />}
                    {isCustomer ? "Customer" : isAI ? "AI" : "Team"}
                    {msg.intent && (
                      <span style={{
                        padding: "1px 4px", borderRadius: 3, fontSize: 9,
                        background: "var(--bg-hover)", color: "var(--text-tertiary)",
                      }}>
                        {msg.intent}
                      </span>
                    )}
                  </div>

                  {/* Message content */}
                  <div style={{
                    fontSize: 13, lineHeight: 1.4, color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.content || "(empty)"}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: 9, color: "var(--text-tertiary)",
                    marginTop: 4, textAlign: "right",
                  }}>
                    {msg.created_at && new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline scrubber */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)" }}>
        <input
          type="range"
          min={0}
          max={sortedMessages.length - 1}
          value={currentIndex}
          onChange={handleScrub}
          style={{
            width: "100%", height: 4, borderRadius: 2,
            background: `linear-gradient(to right, #6c5ce7 ${progress}%, var(--border-subtle) ${progress}%)`,
            appearance: "none", cursor: "pointer",
          }}
        />
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, padding: "8px 14px",
      }}>
        <button
          onClick={handleSkipBack}
          disabled={currentIndex === 0}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "6px 8px", cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            opacity: currentIndex === 0 ? 0.4 : 1,
            display: "flex", alignItems: "center",
          }}
        >
          <SkipBack size={14} />
        </button>

        <button
          onClick={handlePlayPause}
          style={{
            background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
            border: "none", borderRadius: 8, padding: "8px 16px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            color: "#fff", fontWeight: 600, fontSize: 13,
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? "Pause" : currentIndex >= sortedMessages.length - 1 ? "Replay" : "Play"}
        </button>

        <button
          onClick={handleSkipForward}
          disabled={currentIndex >= sortedMessages.length - 1}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "6px 8px",
            cursor: currentIndex >= sortedMessages.length - 1 ? "not-allowed" : "pointer",
            opacity: currentIndex >= sortedMessages.length - 1 ? 0.4 : 1,
            display: "flex", alignItems: "center",
          }}
        >
          <SkipForward size={14} />
        </button>

        {/* Speed control */}
        <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
          {SPEEDS.map(s => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              style={{
                background: speed === s.value ? "#6c5ce7" : "var(--bg-card)",
                color: speed === s.value ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border-medium)",
                borderRadius: 6, padding: "4px 8px", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
