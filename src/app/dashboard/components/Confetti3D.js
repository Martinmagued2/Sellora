"use client";

import { useEffect, useRef } from "react";

/**
 * Confetti3D — physics-based 3D confetti using Canvas 2D with 3D projection.
 * No WebGL needed — uses 2D canvas with z-depth simulation for performance.
 *
 * Usage: <Confetti3D trigger={milestoneReached} />
 * Or call the ref method: confettiRef.current.burst()
 */
export default function Confetti3D({ trigger, count = 80, colors }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  const lastTriggerRef = useRef(null);

  const palette = colors || ["#6c5ce7", "#00d2ff", "#f8a532", "#3ba55c", "#fd79a8", "#ffffff"];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gravity = 0.15;
      const drag = 0.99;

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      for (const p of particlesRef.current) {
        // Physics
        p.vx *= drag;
        p.vy += gravity;
        p.vz *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.rotation += p.rotSpeed;
        p.life -= 1;

        // 3D projection — scale based on z
        const scale = Math.max(0.1, 1 + p.z / 500);
        const alpha = Math.min(1, p.life / 60);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(scale, scale);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        // Draw shape (alternating circles + rects for variety)
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        }
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const burst = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 3;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = Math.random() * 12 + 6;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 50,
        y: cy + (Math.random() - 0.5) * 50,
        z: (Math.random() - 0.5) * 200,
        vx: Math.cos(angle) * speed * (Math.random() * 0.6 + 0.4),
        vy: Math.sin(angle) * speed * (Math.random() * 0.6 + 0.4) - 4,
        vz: (Math.random() - 0.5) * 10,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 6 + 4,
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: Math.random() > 0.5 ? "circle" : "rect",
        life: Math.random() * 60 + 80,
      });
    }
  };

  // Trigger when the `trigger` prop changes to true
  useEffect(() => {
    if (trigger && trigger !== lastTriggerRef.current) {
      lastTriggerRef.current = trigger;
      burst();
    }
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10001,
      }}
    />
  );
}
