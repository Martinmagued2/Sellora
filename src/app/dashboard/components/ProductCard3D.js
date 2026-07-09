"use client";

import { useRef, useState } from "react";

/**
 * ProductCard3D — CSS-based 3D tilt card with depth layers.
 * No WebGL needed — uses CSS transforms for buttery-smooth 60fps tilt.
 *
 * Layers (image, title, price) sit at different Z depths for a parallax effect.
 */
export default function ProductCard3D({ product, onClick, children }) {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState("");
  const [glare, setGlare] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`);
    setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(800px) rotateX(0) rotateY(0) scale(1)");
    setGlare({ x: 50, y: 50 });
  };

  const imageUrls = product?.image_urls || product?.images || [];
  const imageUrl = Array.isArray(imageUrls) ? imageUrls[0] : imageUrls;
  const price = product?.price || 0;
  const stock = product?.stock || 0;
  const status = product?.status || "active";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform,
        transition: transform ? "none" : "transform 0.4s ease",
        transformStyle: "preserve-3d",
        cursor: "pointer",
        borderRadius: 16,
        overflow: "visible",
        position: "relative",
      }}
    >
      <div style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-subtle)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Image layer — closest to viewer */}
        <div style={{
          transform: "translateZ(40px)",
          transformStyle: "preserve-3d",
          height: 160,
          background: imageUrl ? `url(${imageUrl}) center/cover` : "var(--bg-glass)",
          position: "relative",
        }}>
          {/* Glare overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.15), transparent 50%)`,
            pointerEvents: "none",
          }} />
          {/* Status badge */}
          {status !== "active" && (
            <div style={{
              position: "absolute", top: 8, right: 8,
              padding: "2px 8px", borderRadius: 6,
              background: status === "draft" ? "rgba(248,165,50,0.9)" : "rgba(255,82,82,0.9)",
              color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            }}>{status}</div>
          )}
          {/* Stock badge */}
          {stock <= 5 && stock > 0 && (
            <div style={{
              position: "absolute", bottom: 8, left: 8,
              padding: "2px 8px", borderRadius: 6,
              background: "rgba(255,145,0,0.9)", color: "white",
              fontSize: 10, fontWeight: 700,
            }}>Only {stock} left</div>
          )}
        </div>

        {/* Content layer — mid depth */}
        <div style={{ padding: "12px 14px", transform: "translateZ(20px)", transformStyle: "preserve-3d" }}>
          <div style={{
            fontSize: 14, fontWeight: 700, marginBottom: 4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{product?.name || "Untitled Product"}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>
            {product?.category || "General"}
          </div>

          {/* Price layer — furthest from viewer (deepest) */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            transform: "translateZ(10px)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent-primary)" }}>
              {Number(price).toLocaleString()} <span style={{ fontSize: 12 }}>EGP</span>
            </div>
            {product?.variants && product.variants.length > 0 && (
              <div style={{
                fontSize: 10, color: "var(--text-tertiary)",
                padding: "2px 8px", borderRadius: 6, background: "var(--bg-glass)",
              }}>{product.variants.length} variants</div>
            )}
          </div>
        </div>

        {/* Children (action buttons) */}
        {children && (
          <div style={{ padding: "0 14px 12px", transform: "translateZ(15px)" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
