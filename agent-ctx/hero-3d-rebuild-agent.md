# Task: Rebuild Sellora Hero with Real Three.js (React Three Fiber)

## Summary
Replaced the generic AI SaaS template hero section with a premium, handcrafted 3D scene using React Three Fiber.

## Files Modified

### 1. `/home/z/my-project/sellora-fix/src/app/components/HeroScene3D.js`
**Complete rewrite** — From CSS-only dots/orbs to a real 3D R3F scene:
- **AICore**: Glowing icosahedron with wireframe shell, pulse animation, emissive materials (#4F46E5, #7C3AED)
- **ChatBubble** (5 orbiting): Rounded spheres orbiting at different radii/speeds with drei Text ("Hi! Is this available?", "450 EGP", "Order confirmed ✅", etc.)
- **MessageCard** (4 floating): Flat planes with text and border outlines, gentle bob/rotate animations
- **ConnectionLines**: Dynamic lines from orbiting bubbles to core, updated per frame
- **SceneInteraction**: Mouse-reactive scene rotation (subtle tilt based on cursor)
- **AmbientParticles**: 50 instanced particles with seeded random positions (lint-safe)
- SSR-safe: Uses `useSyncExternalStore` for client detection
- Wrapped in Canvas with proper dpr, alpha, and power settings

### 2. `/home/z/my-project/sellora-fix/src/app/page.js`
**Hero section redesigned** (lines ~693-764):
- Removed: `ParticleCanvas`, `MorphBlob`, cursor glow, floating notification badges, grid overlay
- New layout: 3D canvas as full background, text overlay on top, left-aligned editorial style
- Headline: "Never Lose a Customer Because You Replied Too Late." (kept)
- Subheadline with t() i18n (kept)
- CTAs: "Join the Waitlist" and "Watch Demo" clean buttons (kept, no magnetic gimmick)
- Stats strip: Full-width glassmorphism bar at bottom of hero (5,000+ sellers, 2.5M+ messages, 3x avg sales, 98% uptime)
- All other sections unchanged

### 3. `/home/z/my-project/sellora-fix/src/app/globals.css`
**Hero styles updated**:
- Removed: `.bg-grid`, `.hero-float-el`, `.hero-float-icon`, `.hero-glow-1/2`, `.hero-layout`, `.hero-layout-centered`, `.hero-badge`, `.hero-phone`
- Added: `.hero-3d-canvas` (absolute, z-0), `.hero-overlay` (z-1, flex), `.hero-left-aligned` (editorial), `.hero-headline` (clamp 2.5rem-5rem), `.stats-strip` (glassmorphism bar), `.stats-strip-item/value/label/divider`
- Responsive: Updated breakpoints for new hero layout, stats strip mobile support
- All other section CSS preserved

## Build Status
- `npm run build`: ✅ Compiled successfully
- `eslint`: 0 errors, 3 pre-existing warnings (img elements, useEffect deps)
- Lint-safe: No Math.random in render, no setState in effect, no ref access during render
