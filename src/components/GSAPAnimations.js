"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function GSAPAnimations() {
  const containerRef = useRef(null);

  useGSAP(
    () => {
      /* ─── Reduced motion check ─── */
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        /* Set all animated elements to final state */
        gsap.set(
          [
            ".hero-word",
            ".hero-subtitle-mask",
            ".hero-cta-btn",
            ".stat-counter",
            ".hero-float-el",
            ".glass-card",
            ".tilt-card",
            ".problem-left",
            ".problem-right",
            ".solution-left",
            ".solution-right",
            ".dashboard-preview-card",
            ".hub-node",
            ".chat-demo-msg",
            ".roi-result-card",
            ".pricing-card",
            ".testimonial-card",
            ".step-card",
            ".section-title-reveal",
          ],
          { opacity: 1, y: 0, x: 0, scale: 1, clipPath: "inset(0 0 0 0)" }
        );
        ScrollTrigger.getAll().forEach((t) => t.kill());
        return;
      });

      /* ═══════════════════════════════════════
         A. HERO SECTION ANIMATIONS
         ═══════════════════════════════════════ */

      /* A1. Hero title — word-by-word reveal */
      const heroWords = containerRef.current?.querySelectorAll(".hero-word");
      if (heroWords && heroWords.length > 0) {
        gsap.fromTo(
          heroWords,
          { opacity: 0, y: 80 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: "power3.out",
            delay: 0.3,
          }
        );
      }

      /* A2. Hero subtitle — clip-path mask reveal */
      const heroSubtitle = containerRef.current?.querySelector(".hero-subtitle-mask");
      if (heroSubtitle) {
        gsap.fromTo(
          heroSubtitle,
          { clipPath: "inset(100% 0 0 0)", opacity: 0 },
          {
            clipPath: "inset(0 0 0 0)",
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            delay: 0.7,
          }
        );
      }

      /* A3. CTA buttons — pop in with back.out easing */
      const ctaBtns = containerRef.current?.querySelectorAll(".hero-cta-btn");
      if (ctaBtns && ctaBtns.length > 0) {
        gsap.fromTo(
          ctaBtns,
          { opacity: 0, scale: 0.7, y: 20 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.12,
            ease: "back.out(1.4)",
            delay: 1.0,
          }
        );
      }

      /* A4. Stat counters — count up animation */
      const statCounters = containerRef.current?.querySelectorAll(".stat-counter");
      if (statCounters && statCounters.length > 0) {
        statCounters.forEach((counter) => {
          const target = parseFloat(counter.getAttribute("data-target")) || 0;
          const obj = { value: 0 };
          gsap.to(obj, {
            value: target,
            duration: 2,
            delay: 1.2,
            ease: "power2.out",
            snap: { value: 1 },
            onUpdate: () => {
              counter.textContent = Math.round(obj.value).toLocaleString();
            },
          });
        });
      }

      /* A5. Floating notification elements — gentle y-axis floating */
      const floatEls = containerRef.current?.querySelectorAll(".hero-float-el");
      if (floatEls && floatEls.length > 0) {
        floatEls.forEach((el, i) => {
          const offset = 6 + Math.random() * 6;
          const duration = 3 + Math.random() * 2;
          gsap.to(el, {
            y: `+=${offset}`,
            duration: duration,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: i * 0.3,
          });
        });
      }

      /* ═══════════════════════════════════════
         B. SCROLL-TRIGGERED SECTION REVEALS
         ═══════════════════════════════════════ */

      /* B1. Glass cards & tilt cards — batch reveal (keeps ScrollTriggers low) */
      ScrollTrigger.batch(".glass-card, .tilt-card", {
        onEnter: (elements) => {
          gsap.to(elements, {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            duration: 0.6,
            ease: "power2.out",
            overwrite: true,
          });
        },
        start: "top 90%",
        once: true,
      });

      /* Set initial state for batch targets */
      gsap.set(".glass-card, .tilt-card", { opacity: 0, y: 40 });

      /* B2. Problem section — left/right slide */
      const problemLeft = containerRef.current?.querySelector(".problem-left");
      const problemRight = containerRef.current?.querySelector(".problem-right");

      if (problemLeft) {
        gsap.fromTo(
          problemLeft,
          { opacity: 0, x: -60 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: problemLeft,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      if (problemRight) {
        gsap.fromTo(
          problemRight,
          { opacity: 0, x: 60 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: problemRight,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B3. Solution section — reversed emphasis (right slides in from left, left from right) */
      const solutionLeft = containerRef.current?.querySelector(".solution-left");
      const solutionRight = containerRef.current?.querySelector(".solution-right");

      if (solutionRight) {
        gsap.fromTo(
          solutionRight,
          { opacity: 0, x: -60 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: solutionRight,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      if (solutionLeft) {
        gsap.fromTo(
          solutionLeft,
          { opacity: 0, x: 60 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: solutionLeft,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B4. Dashboard preview — scale in */
      const dashboardPreview = containerRef.current?.querySelector(".dashboard-preview-card");
      if (dashboardPreview) {
        gsap.fromTo(
          dashboardPreview,
          { opacity: 0, scale: 0.95 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: dashboardPreview,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B5. Integrations hub nodes — scale from 0 with back.out */
      const hubNodes = containerRef.current?.querySelectorAll(".hub-node");
      if (hubNodes && hubNodes.length > 0) {
        gsap.fromTo(
          hubNodes,
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.15,
            ease: "back.out(1.4)",
            scrollTrigger: {
              trigger: hubNodes[0].parentElement,
              start: "top 75%",
              once: true,
            },
          }
        );
      }

      /* B6. AI Chat demo messages — staggered reveal */
      const chatMsgs = containerRef.current?.querySelectorAll(".chat-demo-msg");
      if (chatMsgs && chatMsgs.length > 0) {
        gsap.fromTo(
          chatMsgs,
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: chatMsgs[0].parentElement,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B7. ROI calculator results — counter animation */
      const roiResults = containerRef.current?.querySelectorAll(".roi-result-card");
      if (roiResults && roiResults.length > 0) {
        gsap.fromTo(
          roiResults,
          { opacity: 0, x: 30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.5,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: roiResults[0].parentElement,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B8. Pricing cards — staggered reveal */
      const pricingCards = containerRef.current?.querySelectorAll(".pricing-card");
      if (pricingCards && pricingCards.length > 0) {
        gsap.fromTo(
          pricingCards,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: pricingCards[0].parentElement,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B9. Testimonial cards — staggered reveal with different y offsets */
      const testimonialCards = containerRef.current?.querySelectorAll(".testimonial-card");
      if (testimonialCards && testimonialCards.length > 0) {
        gsap.fromTo(
          testimonialCards,
          { opacity: 0, y: (i) => 30 + (i % 2) * 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: testimonialCards[0].parentElement,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B10. How It Works steps — staggered reveal */
      const stepCards = containerRef.current?.querySelectorAll(".step-card");
      if (stepCards && stepCards.length > 0) {
        gsap.fromTo(
          stepCards,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: stepCards[0].parentElement,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      /* B11. Section titles reveal */
      const sectionTitles = containerRef.current?.querySelectorAll(".section-title-reveal");
      if (sectionTitles && sectionTitles.length > 0) {
        sectionTitles.forEach((title) => {
          gsap.fromTo(
            title,
            { opacity: 0, y: 25 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: {
                trigger: title,
                start: "top 85%",
                once: true,
              },
            }
          );
        });
      }

      /* ═══════════════════════════════════════
         C. NAVBAR SHRINK ON SCROLL
         ═══════════════════════════════════════ */
      const navbar = containerRef.current?.querySelector("#navbar");
      if (navbar) {
        ScrollTrigger.create({
          trigger: document.documentElement,
          start: "top -80",
          onEnter: () => {
            gsap.to(navbar, {
              height: 60,
              backdropFilter: "blur(20px)",
              backgroundColor: "rgba(var(--bg-primary-rgb, 255,255,255), 0.85)",
              duration: 0.3,
              ease: "power2.out",
            });
            navbar.classList.add("gsap-scrolled");
          },
          onLeaveBack: () => {
            gsap.to(navbar, {
              height: "auto",
              backdropFilter: "blur(0px)",
              backgroundColor: "transparent",
              duration: 0.3,
              ease: "power2.out",
            });
            navbar.classList.remove("gsap-scrolled");
          },
        });
      }

      /* ═══════════════════════════════════════
         D. PARALLAX EFFECTS
         ═══════════════════════════════════════ */
      const heroGlows = containerRef.current?.querySelectorAll(".hero-glow-1, .hero-glow-2");
      if (heroGlows && heroGlows.length > 0) {
        heroGlows.forEach((glow, i) => {
          gsap.to(glow, {
            y: (i === 0 ? -80 : -50),
            ease: "none",
            scrollTrigger: {
              trigger: glow.closest("section") || glow.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });
        });
      }

      const morphBlobs = containerRef.current?.querySelectorAll(".hero svg");
      if (morphBlobs && morphBlobs.length > 0) {
        morphBlobs.forEach((blob, i) => {
          gsap.to(blob, {
            y: -40 - i * 20,
            ease: "none",
            scrollTrigger: {
              trigger: blob.closest("section") || blob.parentElement,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
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
