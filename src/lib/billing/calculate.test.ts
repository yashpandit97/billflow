import { describe, expect, it } from "vitest";
import { calculateBill } from "./calculate";

describe("calculateBill", () => {
  it("calculates a single item", () => {
    const result = calculateBill({
      lines: [{ quantity: 1, unitPrice: 50000, taxRateBps: 0, lineDiscount: 0 }],
      billDiscount: 0,
      taxEnabled: true,
    });
    expect(result.subtotal).toBe(50000);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(50000);
  });

  it("handles multiple quantities", () => {
    const result = calculateBill({
      lines: [{ quantity: 3, unitPrice: 10000, taxRateBps: 0, lineDiscount: 0 }],
      billDiscount: 0,
      taxEnabled: true,
    });
    expect(result.subtotal).toBe(30000);
    expect(result.total).toBe(30000);
  });

  it("applies line and bill discounts with tax", () => {
    const result = calculateBill({
      lines: [
        { quantity: 2, unitPrice: 50000, taxRateBps: 1800, lineDiscount: 0 },
        { quantity: 1, unitPrice: 25000, taxRateBps: 1800, lineDiscount: 0 },
      ],
      billDiscount: 5000,
      taxEnabled: true,
    });
    // subtotal 125000, discount 5000 → taxable 120000 @ 18% = 21600
    expect(result.subtotal).toBe(125000);
    expect(result.discount).toBe(5000);
    expect(result.tax).toBe(21600);
    expect(result.total).toBe(141600);
  });

  it("supports zero tax when disabled", () => {
    const result = calculateBill({
      lines: [{ quantity: 1, unitPrice: 10000, taxRateBps: 1800, lineDiscount: 0 }],
      billDiscount: 0,
      taxEnabled: false,
    });
    expect(result.tax).toBe(0);
    expect(result.total).toBe(10000);
  });

  it("handles decimal prices via minor units", () => {
    const result = calculateBill({
      lines: [{ quantity: 1, unitPrice: 1299, taxRateBps: 500, lineDiscount: 0 }],
      billDiscount: 0,
      taxEnabled: true,
    });
    expect(result.subtotal).toBe(1299);
    expect(result.tax).toBe(65); // round half up of 64.95
    expect(result.total).toBe(1364);
  });

  it("handles large quantities without float drift", () => {
    const result = calculateBill({
      lines: [{ quantity: 1000, unitPrice: 199, taxRateBps: 0, lineDiscount: 0 }],
      billDiscount: 0,
      taxEnabled: true,
    });
    expect(result.subtotal).toBe(199000);
    expect(result.total).toBe(199000);
  });

  it("clamps bill discount to subtotal", () => {
    const result = calculateBill({
      lines: [{ quantity: 1, unitPrice: 1000, taxRateBps: 0, lineDiscount: 0 }],
      billDiscount: 5000,
      taxEnabled: true,
    });
    expect(result.discount).toBe(1000);
    expect(result.total).toBe(0);
  });

  it("applies per-line discount", () => {
    const result = calculateBill({
      lines: [{ quantity: 2, unitPrice: 10000, taxRateBps: 0, lineDiscount: 500 }],
      billDiscount: 0,
      taxEnabled: true,
    });
    expect(result.subtotal).toBe(19500);
    expect(result.total).toBe(19500);
  });
});
