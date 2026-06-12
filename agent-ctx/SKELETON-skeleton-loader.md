---
Task ID: SKELETON
Agent: Skeleton Loader Agent
Task: Replace "Loading..." text/spinners with skeleton screen system across Sellora dashboard

Work Log:
- Read worklog.md for project context (security audit findings)
- Created `/src/components/SkeletonLoader.js` with 6 exports:
  - `Skeleton` — base shimmer block with configurable width, height, borderRadius
  - `StatCardSkeleton` — mimics stat card layout (label, icon, value, subtitle)
  - `PanelSkeleton` — mimics dashboard panels with rows of avatar + text + value
  - `TableSkeleton` — mimics data tables with header + row shimmer blocks
  - `DashboardSkeleton` — full dashboard page skeleton (stats grid + panels)
  - `PageSkeleton` — generic page skeleton (header + stats + filter bar + table)
- Added skeleton CSS animations to `/src/app/dashboard/dashboard.css`:
  - `@keyframes skeleton-shimmer` — left-to-right shimmer animation
  - `.skeleton-block` — gradient with purple accent shimmer
  - `.stat-card .skeleton-block` — adjusted for card background
  - Inserted BEFORE responsive media queries as specified
- Fixed `Math.random()` lint error in TableSkeleton by using deterministic pseudo-random widths
- Modified 8 dashboard pages to use skeleton loaders:
  1. `dashboard/page.js` — replaced "Loading dashboard..." with `<DashboardSkeleton />`
  2. `orders/page.js` — replaced "Loading orders..." with `<PageSkeleton showStats={false} showTable={false} />`
  3. `customers/page.js` — replaced "Loading customers..." with `<PageSkeleton showStats={false} showTable={false} />`
  4. `products/page.js` — replaced "Loading products..." with `<PageSkeleton showStats={false} showTable={false} />`
  5. `analytics/page.js` — replaced "Loading analytics..." with `<PageSkeleton showStats={true} showTable={false} />`
  6. `campaigns/page.js` — replaced "Loading campaigns..." with `<PageSkeleton showStats={false} showTable={false} />`
  7. `abandoned-carts/page.js` — replaced Loader2 spinner + text with `<PageSkeleton showStats={false} showTable={false} />`
  8. `coupons/page.js` — replaced "Loading coupons..." with `<PageSkeleton showStats={false} showTable={false} />`
- Updated `/src/components/index.js` to export all skeleton components
- Updated `/src/components/LoadingSpinner.js` with legacy comment (prefer SkeletonLoader)
- Verified no new lint errors introduced (73 errors all pre-existing)

Stage Summary:
- All dashboard pages now show polished skeleton shimmer placeholders instead of plain "Loading..." text
- The skeleton system uses existing CSS variables (--bg-card, --bg-glass, accent purple) for visual consistency
- Shimmer animation runs at 1.8s ease-in-out infinite for subtle, non-distracting effect
