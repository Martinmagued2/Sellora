"use client";

import { useState } from "react";

/**
 * WhatsAppPreview — a mock WhatsApp phone screen showing how a
 * broadcast message will look on the customer's phone.
 *
 * Renders a phone mockup with:
 * - WhatsApp chat header (business name + avatar)
 * - The message text with {name} → "Ahmed" preview
 * - Time stamp
 * - WhatsApp green background
 *
 * Usage:
 *   <WhatsAppPreview message="Hi {name}! 20% off today!" businessName="My Store" />
 */
export default function WhatsAppPreview({ message = "", businessName = "My Store", logoUrl }) {
  const [time] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  });

  // Replace {name} with a preview name
  const previewMessage = (message || "")
    .replace(/\{name\}/gi, "Ahmed")
    .replace(/\{business_name\}/gi, businessName)
    .replace(/\{customer_name\}/gi, "Ahmed");

  return (
    <div style={{
      width: 280, height: 480, borderRadius: 28,
      background: "#0a0b0f", padding: 8,
      border: "3px solid #1a1a2e",
      boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
      position: "relative", overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Phone notch */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 80, height: 18, background: "#0a0b0f", borderRadius: "0 0 12px 12px", zIndex: 10,
      }} />

      {/* WhatsApp screen */}
      <div style={{
        width: "100%", height: "100%", borderRadius: 20,
        background: "#0b141a", overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Chat header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "24px 12px 8px 12px",
          background: "#1f2c33",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {/* Back arrow */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: logoUrl ? "transparent" : "linear-gradient(135deg, #5865F2, #00D2FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", flexShrink: 0,
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {businessName?.charAt(0)?.toUpperCase() || "S"}
              </span>
            )}
          </div>
          {/* Name */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e9edef" }}>{businessName}</div>
            <div style={{ fontSize: 10, color: "#8696a0" }}>online</div>
          </div>
        </div>

        {/* Chat body */}
        <div style={{
          flex: 1, padding: 12, overflowY: "auto",
          background: `linear-gradient(180deg, #0b141a 0%, #0b141a 100%)`,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='%231a262d'/%3E%3C/svg%3E")`,
        }}>
          {/* Date separator */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{
              fontSize: 10, color: "#8696a0",
              background: "#1f2c33", padding: "2px 10px", borderRadius: 8,
            }}>
              Today
            </span>
          </div>

          {/* Message bubble */}
          {previewMessage.trim() ? (
            <div style={{
              maxWidth: "85%", marginLeft: "auto",
              background: "#005c4b", borderRadius: "8px 8px 0 8px",
              padding: "8px 10px", position: "relative",
              boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
            }}>
              <p style={{
                margin: 0, fontSize: 12.5, color: "#e9edef",
                lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {previewMessage}
              </p>
              {/* Time + double tick */}
              <div style={{
                display: "flex", alignItems: "center", gap: 3,
                justifyContent: "flex-end", marginTop: 2,
              }}>
                <span style={{ fontSize: 9, color: "#8696a0" }}>{time}</span>
                {/* Blue double tick (read) */}
                <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                  <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-5.46 7.06-1.74-1.94a.46.46 0 00-.336-.147.471.471 0 00-.343.146.457.457 0 00-.144.336c0 .131.048.243.144.336l2.12 2.352c.099.108.219.162.36.162a.486.486 0 00.375-.181l5.682-7.348a.451.451 0 00.103-.288.457.457 0 00-.166-.368z" fill="#53bdeb" />
                  <path d="M15.099.66a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-5.46 7.06-.39-.433-.708.858 1.098 1.218c.099.108.219.162.36.162a.486.486 0 00.375-.181l5.682-7.348a.451.451 0 00.103-.288.457.457 0 00-.166-.368z" fill="#53bdeb" />
                </svg>
              </div>
              {/* Tail */}
              <div style={{
                position: "absolute", right: -6, top: 0,
                width: 0, height: 0,
                borderTop: "8px solid #005c4b",
                borderRight: "6px solid transparent",
              }} />
            </div>
          ) : (
            <div style={{
              textAlign: "center", padding: 40,
              color: "#8696a0", fontSize: 12,
            }}>
              Type your message to see a preview...
            </div>
          )}
        </div>

        {/* Input bar (decorative) */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "#1f2c33",
        }}>
          <div style={{
            flex: 1, height: 32, borderRadius: 20,
            background: "#2a3942", display: "flex", alignItems: "center",
            padding: "0 12px",
          }}>
            <span style={{ fontSize: 11, color: "#8696a0" }}>Type a message</span>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#00a884", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
