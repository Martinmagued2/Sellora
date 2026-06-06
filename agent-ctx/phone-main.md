# Task ID: phone - Interactive Phone Zoom Animation

## Agent: main
## Task: Add interactive mobile phone mockup with scroll-triggered zoom animation to homepage hero section

### Work Log

1. **Read existing code** - Analyzed `/home/z/my-project/src/app/page.js` (~1600 lines) and `/home/z/my-project/src/app/globals.css` (~2700 lines)
2. **Replaced FloatingPhone component** (lines 172-350 in page.js)
   - Old: Simple phone with chat UI, basic framer-motion scroll transforms
   - New: Scroll-triggered zoom with imperative transform control
3. **Key technical approach**:
   - Uses `useScroll` from framer-motion to track scroll progress
   - Subscribes to `scrollYProgress.on("change")` for imperative transform updates
   - Avoids framer-motion's reactive `useTransform` for better performance control
   - Calculates: scale (0.6→1.0), rotateY (-20°→0°), rotateX (8°→0°), translateY (80→0px)
   - Eased with cubic ease-out: `1 - (1 - progress)³`
   - Parallax: continuous `-60px` movement based on raw scroll progress
4. **Dashboard UI inside phone**:
   - Header with Sellora logo, Bell icon with red notification dot, avatar
   - 3 stat cards (Revenue/Orders/Users) in grid
   - Weekly sales bar chart with gradient-highlighted peak bar
   - Recent orders table with color-coded status badges
   - Home indicator bar at bottom
5. **Glow and reflection effects**:
   - Phone glow div with dynamic `box-shadow` based on `glowIntensity * eased`
   - Reflection overlay with `linear-gradient` that rotates based on scroll position
   - Both use CSS custom properties for consistency
6. **Hero layout change**:
   - Changed from centered single-column to two-column grid
   - `.hero-layout` with `grid-template-columns: 1fr 1fr`
   - Text left-aligned on desktop, `.hero-content` max-width 600px
   - `.hero-phone` wraps the FloatingPhone component
   - Responsive: single column at 1024px and 768px
7. **Mobile handling**:
   - `isMobile` state detects viewport < 768px
   - On mobile: no scroll-zoom animation, just fade-in
   - Float badges hidden on mobile
   - Phone appears above text on mobile (`order: -1`)
8. **CSS additions** (~270 lines in globals.css):
   - `.phone-zoom-wrapper`, `.phone-zoom-container`
   - `.phone-glow`, `.phone-at-rest`, `@keyframes phone-float-bob`
   - `.phone-frame` (updated with better shadows, rounded corners)
   - `.phone-notch`, `.phone-notch-camera`, `.phone-home-indicator`
   - `.phone-reflection`
   - `.phone-dash-header`, `.phone-dash-stats`, `.phone-dash-stat-card/label/value/change`
   - `.phone-dash-chart/header/bars/bar-wrapper/bar`
   - `.phone-dash-orders/order-row/id/name/amount/status`
   - Responsive overrides at 1024px and 768px breakpoints

### Stage Summary
- Homepage hero now has an interactive phone that zooms in on scroll with premium feel
- Phone displays a mini Sellora dashboard UI (not just chat)
- 3D rotation, parallax depth, glow, and reflection effects all respond to scroll position
- Subtle float/bob animation plays when phone reaches full zoom
- Mobile-friendly: simple fixed-size phone with fade-in, no complex transforms
- All existing sections and animations are preserved
- Added `Bell` import from lucide-react
