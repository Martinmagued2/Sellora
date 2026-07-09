import Link from "next/link";

export default function NotFound() {
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
        fontSize: "80px",
        fontWeight: 800,
        background: "linear-gradient(135deg, #00d2ff, #7b2ff7)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        lineHeight: 1,
        marginBottom: "16px",
      }}>404</div>
      <h1 style={{
        fontSize: "24px",
        fontWeight: 700,
        marginBottom: "12px",
      }}>Page Not Found</h1>
      <p style={{
        fontSize: "15px",
        color: "var(--text-tertiary, #888)",
        maxWidth: "400px",
        lineHeight: 1.6,
        marginBottom: "32px",
      }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
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
          textDecoration: "none",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
