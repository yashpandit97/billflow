import { describe, expect, it } from "vitest";
import { validateDiscountAmount } from "@/lib/billing/discount-limits";
import { calculateBill } from "@/lib/billing/calculate";

describe("discount limits", () => {
  it("rejects discount above subtotal", () => {
    expect(validateDiscountAmount("owner", 10000, 15000).ok).toBe(false);
  });

  it("caps staff discount at 10%", () => {
    expect(validateDiscountAmount("staff", 100000, 15000).ok).toBe(false);
    expect(validateDiscountAmount("staff", 100000, 10000).ok).toBe(true);
  });
});

describe("server-side bill calculation", () => {
  it("ignores client-provided totals — recalculates from DB prices", () => {
    const calc = calculateBill({
      taxEnabled: true,
      billDiscount: 0,
      lines: [{ quantity: 2, unitPrice: 50000, taxRateBps: 0, lineDiscount: 0 }],
    });
    expect(calc.total).toBe(100000);
  });

  it("customer invoice total has no platform fee component", () => {
    const calc = calculateBill({
      taxEnabled: false,
      billDiscount: 0,
      lines: [{ quantity: 1, unitPrice: 240000, taxRateBps: 0, lineDiscount: 0 }],
    });
    expect(calc.total).toBe(240000);
    expect(calc.subtotal).toBe(240000);
  });
});
