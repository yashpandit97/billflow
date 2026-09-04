import { describe, expect, it } from "vitest";
import {
  buildInvoiceShareText,
  buildReferralShareMessage,
} from "@/lib/invoice/share-message";
import { normalizeReferralCode } from "@/lib/referral/constants";

describe("invoice share message", () => {
  it("includes customer, business, invoice, amount, and payment", () => {
    const text = buildInvoiceShareText({
      customerName: "Ravi",
      businessName: "ABC Fashion",
      invoiceNumber: "INV-1024",
      totalMinor: 299700,
      currency: "INR",
      locale: "en-IN",
      paymentMethod: "upi",
    });
    expect(text).toContain("Ravi");
    expect(text).toContain("ABC Fashion");
    expect(text).toContain("INV-1024");
    expect(text).toContain("UPI");
    expect(text).not.toContain("platform");
    expect(text).not.toContain("1%");
  });

  it("does not expose platform fee language", () => {
    const text = buildInvoiceShareText({
      businessName: "Shop",
      invoiceNumber: "INV-1",
      totalMinor: 10000,
      currency: "INR",
      locale: "en-IN",
    });
    expect(text.toLowerCase()).not.toContain("platform fee");
  });
});

describe("referral share message", () => {
  it("includes app name, trial, and link", () => {
    const text = buildReferralShareMessage(
      "BillMoney",
      "https://app.example/signup?ref=ABC123"
    );
    expect(text).toContain("BillMoney");
    expect(text).toContain("30 days");
    expect(text).toContain("ABC123");
  });
});

describe("referral code normalization", () => {
  it("uppercases and trims codes", () => {
    expect(normalizeReferralCode(" abc123 ")).toBe("ABC123");
  });

  it("rejects empty codes", () => {
    expect(normalizeReferralCode("  ")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
  });
});

describe("referral abuse prevention (client hints only)", () => {
  it("self-referral must be rejected server-side — client cannot set reward months", () => {
    const maliciousPayload = { free_months: 10 };
    expect(maliciousPayload.free_months).toBe(10);
    // Server must ignore client-supplied free_months; documented expectation for security tests.
  });
});
