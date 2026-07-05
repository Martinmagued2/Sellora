# Sellora Landing Page — Animation Implementation Plan

## Phase 1: Hero Section GSAP Enhancement
- Replace Framer Motion hero entrance with GSAP timeline
- Add text split reveal (word-by-word stagger)
- Add clip-path mask reveal on subtitle
- Add back.out bounce on CTA buttons
- Add GSAP count-up on stat counters
- Add magnetic button hover effect
- Status: **ACTIVE**

## Phase 2: Scroll-Triggered Section Reveals
- Replace all Framer Motion `whileInView` with GSAP ScrollTrigger
- Add ScrollTrigger.batch for card grids
- Add side-slide reveals for Problem/Solution sections
- Add parallax on hero background elements
- Add navbar shrink on scroll
- Status: **PENDING**

## Phase 3: Interactive Elements
- Magnetic button hover effects on all CTAs
- 3D tilt card enhancement for TiltCard component
- Smooth FAQ accordion with GSAP
- Pricing card monthly/annual toggle animation
- Status: **PENDING**

## Phase 4: Smooth Scrolling + Parallax
- Lenis smooth scroll integration
- Parallax on hero 3D scene
- Scrub-linked gradient shifts on CTA section
- Pin + scrub on Dashboard Preview tabs
- Status: **PENDING**

## Phase 5: Dashboard Micro-Interactions
- Page transition wrapper for dashboard routes
- Card hover lift effects across dashboard
- Sidebar item stagger reveal
- Notification badge pulse
- Status: **PENDING**
