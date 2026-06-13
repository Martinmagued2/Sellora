# Task: redesign-1 — Sellora Landing Page Redesign

## Summary
Complete redesign of the Sellora landing page from an AI-generated glassmorphism style to a premium editorial brand design (Linear.app / Raycast inspired).

## Changes Made

### `/home/z/my-project/src/app/page.js`
- **Complete rewrite** (~700 lines, down from ~1317)
- Removed all AI-telltales: ParticleCanvas, MorphBlob, SVGGrainOverlay, HeroScene3D, SVGWaveDivider, SVGFloatingRings, SVGDataFlow, SVGHexGrid, SVGDotPattern, cursor glow, TiltCard
- New DashboardMockup component: CSS/HTML chat UI showing AI auto-reply conversation
- Redesigned ROICalculator with clean white card + solid borders
- All 13 sections implemented as specified in the design direction
- Kept i18n system (useLanguage/t()), SmoothScrollProvider, GSAPAnimations, MagneticButton
- Used Space Grotesk (headings) + JetBrains Mono (accents/labels) via inline fontFamily
- Color palette: #0A0A0A (dark bg), #FAFAFA (light bg), #6C5CE7 (accent), #222222 (dark borders), #E5E5E5 (light borders)

### `/home/z/my-project/src/app/layout.js`
- Added Space Grotesk and JetBrains Mono to Google Fonts import

### `/home/z/my-project/src/components/GSAPAnimations.js`
- Added `.feature-card` to batch reveal selectors
- Added `.feature-card` to reduced-motion override list

### `/home/z/my-project/src/app/globals.css`
- Added responsive CSS rules at end of file for new layout classes
- Media queries for .hero-grid, .problem-grid-new, .steps-grid, .footer-grid, nav elements

## Build Status
✅ `npx next build` passes successfully

## GSAP Class Compatibility
- `.hero-word` ✅
- `.hero-subtitle-mask` ✅
- `.hero-cta-btn` ✅
- `.section-title-reveal` ✅
- `.feature-card` ✅ (new, replaces .glass-card)
- `.problem-left`, `.problem-right` ✅
- `.solution-left`, `.solution-right` ✅
- `.step-card` ✅
- `.pricing-card` ✅
- `.roi-result-card` ✅
