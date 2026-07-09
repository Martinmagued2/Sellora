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
        maxWidth: "400px",
        lineHeight: 1.6,
        marginBottom: "32px",
      }}>
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
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
