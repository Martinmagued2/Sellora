# Sellora Landing Page — Animation Specification

## Brand Signals
- **Theme**: Premium dark glassmorphism, Discord-like purple (#5865F2) + cyan (#00D2FF) accent gradient
- **Tone**: Professional yet innovative, Egyptian SMB-focused SaaS
- **Motion philosophy**: Purposeful, smooth, never flashy for the sake of it

## Current Animation Stack
- Framer Motion (whileInView, AnimatePresence)
- Three.js / React Three Fiber (3D hero scene)
- Canvas (ParticleCanvas with 80 particles)
- SVG SMIL (MorphBlobs, wave dividers, floating rings, data flow)
- CSS @keyframes (marquee, typing indicator, rotating border)

## Target GSAP Stack
- `gsap` core (already installed v3.15.0)
- `@gsap/react` (useGSAP hook)
- `gsap/ScrollTrigger` (scroll-triggered reveals)
- `lenis` (smooth scrolling)

## Animation Inventory

### Hero Section
| Element | Current | Target GSAP |
|---------|---------|-------------|
| Title text | Framer fade+Y | Split text reveal with stagger per word |
| Subtitle | Framer fade+Y | Slide up with clip-path mask |
| CTA buttons | Framer fade+Y | Back.out bounce + magnetic hover |
| Stat counters | Custom JS counter | GSAP snap count-up with ScrollTrigger |
| Floating notifications | Framer y loop | GSAP floating with random offsets |

### Section Reveals
| Section | Current | Target GSAP |
|---------|---------|-------------|
| Problem section | Framer x:-40 | ScrollTrigger batch reveal with stagger |
| Solution section | Framer x:-40 | ScrollTrigger slide-in from sides |
| Feature cards | Framer y:20 stagger | ScrollTrigger.batch with grid stagger |
| Dashboard preview | Framer y:40 | Pin + scrub timeline |
| Integrations hub | Framer scale:0 | Orbital rotation + pulse |
| AI Chat Demo | Framer y:10 stagger | Pinned conversation replay |
| ROI Calculator | Framer x:30 | Counter animation with snap |
| Pricing cards | Framer y:20 | Staggered reveal + magnetic hover |
| FAQ items | CSS height transition | GSAP smooth height animation |
| Final CTA | CSS gradient animation | GSAP gradient shift + scale pulse |

### Global
| Element | Current | Target GSAP |
|---------|---------|-------------|
| Navbar | CSS scroll class | GSAP ScrollTrigger shrink on scroll |
| Page transitions | None | GSAP fade+slide on route change |
| Smooth scroll | Native | Lenis integration |
| Parallax | Not implemented | GSAP scrub-based parallax on hero BG |

## Reduced Motion
All animations must respect `prefers-reduced-motion: reduce`:
- Set all animated elements to final state immediately
- Kill all ScrollTriggers
- No parallax, no pinning
