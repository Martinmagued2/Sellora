import { describe, it, expect } from "vitest";
import { recomputeTotals, generateOrderNumber } from "../cart-utils";

describe("recomputeTotals", () => {
  it("returns zeros for empty cart", () => {
    const r = recomputeTotals([], 0);
    expect(r.subtotal).toBe(0);
    expect(r.discount).toBe(0);
    expect(r.total).toBe(0);
  });

  it("sums price * qty across items", () => {
    const items = [
      { price: 10, qty: 2 },
      { price: 25, qty: 1 },
    ];
    const r = recomputeTotals(items, 0);
    expect(r.subtotal).toBe(45); // 20 + 25
    expect(r.total).toBe(45);
  });

  it("applies discount and floors at zero", () => {
    const items = [{ price: 100, qty: 1 }];
    const r = recomputeTotals(items, 30);
    expect(r.subtotal).toBe(100);
    expect(r.discount).toBe(30);
    expect(r.total).toBe(70);
  });

  it("never goes below zero even if discount > subtotal", () => {
    const items = [{ price: 10, qty: 1 }];
    const r = recomputeTotals(items, 50);
    expect(r.total).toBe(0); // Math.max(0, 10 - 50)
  });

  it("coerces string prices", () => {
    const items = [{ price: "15.50", qty: "2" }];
    const r = recomputeTotals(items, 0);
    expect(r.subtotal).toBe(31);
  });
});

describe("generateOrderNumber", () => {
  it("starts with ORD-", () => {
    const n = generateOrderNumber();
    expect(n.startsWith("ORD-")).toBe(true);
  });

  it("is unique across rapid calls", () => {
    const numbers = new Set();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateOrderNumber());
    }
    expect(numbers.size).toBe(100);
  });
});
