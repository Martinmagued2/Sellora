"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Product360Viewer — 360° product viewer.
 * User drags left/right to rotate through product images.
 *
 * Requires multiple images of the same product from different angles.
 * If only 1 image is available, falls back to a simple rotating effect.
 */

export default function Product360Viewer({ images = [], productName = "Product", autoRotate = false }) {
  const containerRef = useRef(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [autoFrame, setAutoFrame] = useState(0);

  // Auto-rotate if enabled
  useEffect(() => {
    if (autoRotate && images.length > 1 && !isDragging) {
      const interval = setInterval(() => {
        setAutoFrame(prev => (prev + 1) % images.length);
      }, 80);
      return () => clearInterval(interval);
    }
  }, [autoRotate, images.length, isDragging]);

  const frame = isDragging ? currentFrame : (autoRotate ? autoFrame : currentFrame);
  const currentImage = images[frame % images.length] || images[0];

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX || e.touches?.[0]?.clientX || 0);
    setCurrentFrame(frame);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const delta = clientX - startX;
    const framesPerDrag = 8; // sensitivity
    const newFrame = currentFrame + Math.round(delta / framesPerDrag);
    setCurrentFrame(((newFrame % images.length) + images.length) % images.length);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!images || images.length === 0) {
    return (
      <div ref={containerRef} style={{
        width: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden",
        background: "var(--bg-glass)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "var(--text-tertiary)", fontSize: 14 }}>No images</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      style={{
        width: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        background: "var(--bg-glass)", position: "relative",
        userSelect: "none",
      }}
    >
      <img
        src={currentImage}
        alt={productName}
        draggable={false}
        style={{
          width: "100%", height: "100%", objectFit: "cover",
          transition: isDragging ? "none" : "opacity 0.1s",
        }}
      />

      {/* Drag hint */}
      <div style={{
        position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
        padding: "4px 12px", borderRadius: 12,
        background: "rgba(0,0,0,0.5)", color: "white",
        fontSize: 10, fontWeight: 600, pointerEvents: "none",
        opacity: isDragging ? 0 : 0.8,
        transition: "opacity 0.2s",
        whiteSpace: "nowrap",
      }}>
        ← Drag to rotate →
      </div>

      {/* Frame counter */}
      {images.length > 1 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "2px 8px", borderRadius: 8,
          background: "rgba(0,0,0,0.5)", color: "white",
          fontSize: 10, fontWeight: 700,
        }}>
          {frame + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
