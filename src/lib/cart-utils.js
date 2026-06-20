/**
 * Cart utilities — shared across all cart API routes.
 *
 * Extracted to avoid cross-route imports (which break Next.js builds
 * because route files have special semantics).
 */

export function recomputeTotals(items, discount = 0) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

export function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}
