"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

export default function MagneticButton({ children, className = "", ...props }) {
  const containerRef = useRef(null);

  useGSAP(() => {
    const btn = containerRef.current;
    if (!btn) return;

    const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });

    const handleMouseMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * 0.3;
      const deltaY = (e.clientY - centerY) * 0.3;
      xTo(deltaX);
      yTo(deltaY);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
    };

    btn.addEventListener("mousemove", handleMouseMove);
    btn.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      btn.removeEventListener("mousemove", handleMouseMove);
      btn.removeEventListener("mouseleave", handleMouseLeave);
      xTo(0);
      yTo(0);
    };
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className} {...props}>
      {children}
    </div>
  );
}
