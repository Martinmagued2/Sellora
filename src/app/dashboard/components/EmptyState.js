"use client";

/**
 * EmptyState — friendly empty state with inline SVG illustration.
 *
 * Props:
 *   type: 'orders' | 'conversations' | 'products' | 'customers' | 'generic'
 *   title: string
 *   description: string
 *   actionLabel?: string
 *   onAction?: () => void
 */
export default function EmptyState({ type = "generic", title, description, actionLabel, onAction }) {
  const config = EMPTY_STATE_CONFIG[type] || EMPTY_STATE_CONFIG.generic;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 20px", textAlign: "center",
    }}>
      {/* Illustration */}
      <div style={{
        width: 120, height: 120, marginBottom: 20,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${config.color}15, transparent 70%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {config.illustration}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 18, fontWeight: 700, color: "var(--text-primary, #fff)",
        margin: "0 0 8px 0",
      }}>
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p style={{
        fontSize: 14, color: "var(--text-tertiary, rgba(255,255,255,0.4))",
        maxWidth: 400, lineHeight: 1.6, margin: "0 0 20px 0",
      }}>
        {description || config.defaultDescription}
      </p>

      {/* Action button */}
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: "10px 24px", borderRadius: 10,
            background: "linear-gradient(135deg, #5865F2, #00D2FF)",
            color: "#fff", border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600,
            boxShadow: "0 8px 24px -8px rgba(88,101,242,0.5)",
            transition: "transform 0.15s ease",
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Inline SVG illustrations — no image dependencies
const EMPTY_STATE_CONFIG = {
  orders: {
    color: "#F8A532",
    defaultTitle: "No orders yet",
    defaultDescription: "Your first order will appear here once a customer places one. Connect WhatsApp to start receiving orders!",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#F8A532" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  conversations: {
    color: "#00D2FF",
    defaultTitle: "No conversations yet",
    defaultDescription: "When customers message your WhatsApp, Instagram, or Facebook, their conversations will appear here.",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#00D2FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <line x1="8" y1="9" x2="16" y2="9" />
        <line x1="8" y1="13" x2="13" y2="13" />
      </svg>
    ),
  },
  products: {
    color: "#5865F2",
    defaultTitle: "No products yet",
    defaultDescription: "Add your first product to start selling. The AI agent will use your catalog to recommend items to customers.",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  customers: {
    color: "#3BA55C",
    defaultTitle: "No customers yet",
    defaultDescription: "Customers who message your store will appear here with their purchase history and preferences.",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#3BA55C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  reviews: {
    color: "#f5b400",
    defaultTitle: "No reviews yet",
    defaultDescription: "Reviews appear here automatically after customers receive their orders and submit ratings.",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f5b400" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  generic: {
    color: "#5865F2",
    defaultTitle: "Nothing here yet",
    defaultDescription: "Content will appear here once available.",
    illustration: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};
