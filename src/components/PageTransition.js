"use client";
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function PageTransition({ children }) {
  const ref = useRef(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      gsap.set(ref.current, { opacity: 1, y: 0 });
      return;
    }

    gsap.from(ref.current, {
      opacity: 0,
      y: 16,
      duration: 0.45,
      ease: "power2.out",
    });
  }, { scope: ref });

  return <div ref={ref}>{children}</div>;
}
