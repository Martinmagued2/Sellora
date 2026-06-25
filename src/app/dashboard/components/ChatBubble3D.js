"use client";

import { useRef, useState } from "react";

/**
 * ChatBubbles3D — message bubbles with 3D depth + parallax effect.
 * Bubbles tilt slightly based on scroll position and mouse position.
 * Incoming messages (left) tilt left, outgoing (right) tilt right.
 */

export default function ChatBubble3D({ message, isAI, isOutgoing, index = 0 }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -4, y: x * 4 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const isCustomer = !isOutgoing;

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: "preserve-3d",
        transition: tilt.x === 0 ? "transform 0.3s ease" : "none",
        display: "flex",
        justifyContent: isOutgoing ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div style={{
        maxWidth: "75%",
        padding: "10px 14px",
        borderRadius: isOutgoing ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
        background: isAI
          ? "linear-gradient(135deg, rgba(0,210,255,0.15), rgba(108,92,231,0.1))"
          : isOutgoing
            ? "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
            : "var(--bg-glass)",
        color: isOutgoing && !isAI ? "white" : "var(--text-primary)",
        border: isAI ? "1px solid rgba(0,210,255,0.2)" : "1px solid var(--border-subtle)",
        transform: "translateZ(10px)",
        transformStyle: "preserve-3d",
        boxShadow: isOutgoing
          ? "0 4px 12px rgba(108,92,231,0.2)"
          : "0 2px 8px rgba(0,0,0,0.1)",
        position: "relative",
      }}>
        {/* AI badge */}
        {isAI && (
          <div style={{
            position: "absolute", top: -8, left: 8,
            padding: "1px 6px", borderRadius: 6,
            background: "linear-gradient(135deg, #00d2ff, #6c5ce7)",
            color: "white", fontSize: 8, fontWeight: 800,
            display: "flex", alignItems: "center", gap: 3,
            transform: "translateZ(20px)",
          }}>
            🤖 AI
          </div>
        )}

        {/* Message content */}
        <div style={{
          fontSize: 14, lineHeight: 1.5,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {message.content || message.text || ""}
        </div>

        {/* Timestamp */}
        {message.created_at && (
          <div style={{
            fontSize: 9, opacity: 0.6, marginTop: 4,
            textAlign: isOutgoing ? "right" : "left",
            transform: "translateZ(5px)",
          }}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}
