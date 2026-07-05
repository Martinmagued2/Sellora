"use client";

import { useRef, useState } from "react";

/**
 * TiltCard3D — wraps any child element with a 3D tilt effect on mouse move.
 * Pure CSS transforms — no WebGL, buttery 60fps.
 *
 * Usage:
 *   <TiltCard3D maxTilt={6} glare>
 *     <div>Your card content</div>
 *   </TiltCard3D>
 */
export default function TiltCard3D({ children, maxTilt = 6, glare = true, scale = 1.02, style }) {
  const ref = useRef(null);
  const [transform, setTransform] = useState("");
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)");
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: transform === "" ? "none" : "transform 0.3s ease",
        transformStyle: "preserve-3d",
        position: "relative",
        ...style,
      }}
    >
      {children}
      {glare && (
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "inherit",
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}), transparent 60%)`,
          pointerEvents: "none",
          transition: "opacity 0.2s",
          zIndex: 10,
        }} />
      )}
    </div>
  );
}
