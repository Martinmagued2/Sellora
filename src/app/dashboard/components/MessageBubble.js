"use client";

import {
  Bot, Camera, Check, Loader2, ThumbsUp, ThumbsDown,
} from "lucide-react";
import TiltCard3D from "./TiltCard3D";

/**
 * MessageBubble — renders a single chat message with all the bells:
 *   - AI label + thumbs up/down feedback
 *   - Image attachment with recognize-on-click
 *   - Product card rendering
 *   - Sentiment + intent badges
 *   - Read receipts (double-tick)
 *   - Voice note player (placeholder)
 *
 * Props:
 *   msg              — the message object
 *   intentConfig     — INTENT_CONFIG map from parent
 *   channelIcon      — JSX for the channel icon
 *   formatTime       — (date) => string
 *   onRecognize      — (msgId, mediaUrl) => void
 *   imageRecognition — { [msgId]: result }
 *   onFeedback       — (msgId, rating) => void
 */
export default function MessageBubble({
  msg,
  intentConfig,
  channelIcon,
  formatTime,
  onRecognize,
  imageRecognition,
  onFeedback,
}) {
  const isAI = msg.is_ai;
  const isOutgoing = msg.direction === "outgoing";
  // 🔧 FIX: check both media_url (single) and media_urls (array) for compatibility
  const mediaUrl = msg.media_url || (Array.isArray(msg.media_urls) && msg.media_urls[0]) || null;
  const isImage = (msg.type === "image") && mediaUrl;
  const isProductCard = msg.type === "product_card";
  const isAudio = (msg.type === "audio") && mediaUrl;

  return (
    <div
      key={msg.id}
      className={`chat-msg ${isOutgoing ? (isAI ? "ai-reply" : "outgoing") : "incoming"}`}
    >
      <TiltCard3D maxTilt={3} scale={1.01} glare={false}>
      {isAI && <span className="ai-label"><Bot size={10} /> AI Auto-Reply</span>}

      {/* Sentiment badge on incoming */}
      {msg.sentiment && (msg.sentiment === "negative" || msg.sentiment === "urgent") && !isOutgoing && (
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 8,
          marginBottom: 4, display: "inline-block",
          background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)",
        }}>
          🔴 {msg.sentiment}
        </span>
      )}

      {/* Intent badge on incoming */}
      {msg.intent && msg.intent !== "general" && !isOutgoing && (
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 8,
          marginBottom: 4, display: "inline-block",
          background: intentConfig?.[msg.intent]?.color + "22",
          color: intentConfig?.[msg.intent]?.color,
        }}>
          {intentConfig?.[msg.intent]?.label}
        </span>
      )}

      {/* Image message */}
      {isImage ? (
        <div className="msg-bubble" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: "var(--space-md)", maxWidth: 280 }}>
          <div
            className="chat-image-thumbnail"
            onClick={() => onRecognize && onRecognize(msg.id, mediaUrl)}
          >
            <img src={mediaUrl} alt="Customer sent image" className="chat-image-thumb" />
            {!imageRecognition?.[msg.id] && (
              <div className="chat-image-recognize-hint">
                <Camera size={12} /> Click to find matching products
              </div>
            )}
          </div>
          {imageRecognition?.[msg.id] && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
              {imageRecognition[msg.id]}
            </div>
          )}
          {msg.content && <div style={{ marginTop: 8, whiteSpace: "pre-line" }}>{msg.content}</div>}
        </div>
      ) : isProductCard ? (
        <div className="msg-bubble" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: "var(--space-md)" }}>
          <div style={{ whiteSpace: "pre-line" }}>{msg.content}</div>
        </div>
      ) : isAudio ? (
        <div className="msg-bubble" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", borderRadius: 16, padding: "var(--space-md)", display: "flex", alignItems: "center", gap: 10 }}>
          {mediaUrl ? (
            <>
              <audio controls src={mediaUrl} style={{ height: 32, maxWidth: 200 }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Voice note</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>🎤 Voice note</span>
          )}
        </div>
      ) : (
        <>{msg.content}</>
      )}

      {/* Time + read receipts */}
      <span className="msg-time">
        {formatTime(msg.created_at)}
        {isOutgoing && msg.read_at && (
          <span title={`Read ${new Date(msg.read_at).toLocaleString()}`} style={{ marginLeft: 3, color: "#4fc3f7", display: "inline-flex", verticalAlign: "middle" }}>
            <svg width="14" height="14" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 6l3 3 6-6" />
              <path d="M5 9l3 3 6-6" />
            </svg>
          </span>
        )}
        {isOutgoing && !msg.read_at && msg.delivered_at && (
          <span title={`Delivered ${new Date(msg.delivered_at).toLocaleString()}`} style={{ marginLeft: 3, color: "var(--text-tertiary)", display: "inline-flex", verticalAlign: "middle" }}>
            <svg width="14" height="14" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 6l3 3 6-6" />
              <path d="M5 9l3 3 6-6" />
            </svg>
          </span>
        )}
      </span>

      {/* AI feedback buttons */}
      {isAI && isOutgoing && (
        <div className="ai-feedback" style={{ display: "flex", gap: 4, marginTop: 4, opacity: 0.6 }}>
          <button
            onClick={() => onFeedback && onFeedback(msg.id, "up")}
            title="Good reply"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => onFeedback && onFeedback(msg.id, "down")}
            title="Bad reply"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      )}
      </TiltCard3D>
    </div>
  );
}
