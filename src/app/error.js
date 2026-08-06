"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "40px 20px",
      textAlign: "center",
      fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
      background: "var(--bg-primary, #191a23)",
      color: "var(--text-primary, #f0f0f0)",
    }}>
      <div style={{
        fontSize: "48px",
        marginBottom: "16px",
      }}>
        ⚠️
      </div>
      <h1 style={{
        fontSize: "24px",
        fontWeight: 700,
        marginBottom: "12px",
      }}>Something went wrong</h1>
      <p style={{
        fontSize: "15px",
        color: "var(--text-tertiary, #888)",
        maxWidth: "500px",
        lineHeight: 1.6,
        marginBottom: "12px",
      }}>
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      {error?.message && (
        <details style={{
          marginBottom: 24,
          maxWidth: 600,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 13,
          color: "var(--accent-red, #ff5252)",
          textAlign: "left",
          fontFamily: "monospace",
          wordBreak: "break-word",
        }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 8 }}>Error details</summary>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{error.message}</pre>
          {error.stack && (
            <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0 0", fontSize: 11, opacity: 0.7 }}>{error.stack.slice(0, 500)}</pre>
          )}
        </details>
      )}
      <button
        onClick={reset}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 28px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #00d2ff, #7b2ff7)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "14px",
          border: "none",
          cursor: "pointer",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
