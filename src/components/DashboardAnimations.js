"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function DashboardAnimations() {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      /* ─── Reduced motion check ─── */
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Skip all animations for users who prefer reduced motion
        gsap.set(
          [".glass-card", ".dashboard-panel", ".sidebar-link", ".notification-badge"],
          { opacity: 1, y: 0, scale: 1 }
        );
        return;
      });

      /* ═══════════════════════════════════════
         A. CARD HOVER LIFT EFFECTS
         ═══════════════════════════════════════ */
      const hoverTargets = containerRef.current?.querySelectorAll(
        ".glass-card, .dashboard-panel"
      );

      if (hoverTargets && hoverTargets.length > 0) {
        hoverTargets.forEach((el) => {
          const enterAnim = gsap.to(el, {
            y: -4,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
            duration: 0.25,
            ease: "power2.out",
            paused: true,
          });

          const leaveAnim = gsap.to(el, {
            y: 0,
            boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
            duration: 0.25,
            ease: "power2.in",
            paused: true,
          });

          el.addEventListener("mouseenter", () => {
            leaveAnim.kill();
            enterAnim.restart();
          });

          el.addEventListener("mouseleave", () => {
            enterAnim.kill();
            leaveAnim.restart();
          });
        });
      }

      /* ═══════════════════════════════════════
         B. STAGGERED SIDEBAR ITEM REVEAL
         ═══════════════════════════════════════ */
      const sidebarLinks = containerRef.current?.querySelectorAll(".sidebar-link");

      if (sidebarLinks && sidebarLinks.length > 0) {
        gsap.from(sidebarLinks, {
          opacity: 0,
          x: -12,
          duration: 0.3,
          stagger: 0.04,
          ease: "power2.out",
          delay: 0.1,
        });
      }

      /* ═══════════════════════════════════════
         C. NOTIFICATION BADGE PULSE
         ═══════════════════════════════════════ */
      const badges = containerRef.current?.querySelectorAll(".notification-badge");

      if (badges && badges.length > 0) {
        badges.forEach((badge) => {
          gsap.to(badge, {
            scale: 1.15,
            duration: 0.6,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: 1,
          });
        });
      }

      /* Cleanup */
      return () => {
        mm.revert();
      };
    },
    { scope: containerRef }
  );

  /* This component renders no visible UI — just runs GSAP code */
  return <div ref={containerRef} style={{ display: "contents" }} />;
}
