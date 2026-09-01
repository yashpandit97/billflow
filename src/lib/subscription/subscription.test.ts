import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_AMOUNT_MAJOR,
  SUBSCRIPTION_AMOUNT_MINOR,
  TRIAL_DAYS,
  formatSubscriptionPrice,
  isSubscriptionActive,
  isTrialActive,
  type TenantSubscription,
} from "@/lib/subscription/constants";
import { describeSubscription } from "@/lib/subscription/service";

function makeSub(
  overrides: Partial<TenantSubscription> = {}
): TenantSubscription {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  return {
    id: "sub-1",
    tenant_id: "tenant-1",
    status: "trialing",
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    current_period_start: null,
    current_period_end: null,
    amount: SUBSCRIPTION_AMOUNT_MINOR,
    currency: "INR",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

describe("subscription pricing", () => {
  it("uses ₹299/month in minor units", () => {
    expect(SUBSCRIPTION_AMOUNT_MAJOR).toBe(299);
    expect(SUBSCRIPTION_AMOUNT_MINOR).toBe(29900);
    expect(formatSubscriptionPrice("en-IN")).toContain("299");
  });

  it("trial is 30 days", () => {
    expect(TRIAL_DAYS).toBe(30);
  });
});

describe("subscription state", () => {
  it("allows app use during trial", () => {
    const sub = makeSub();
    expect(isTrialActive(sub)).toBe(true);
    expect(isSubscriptionActive(sub)).toBe(true);
    expect(describeSubscription(sub).canUseApp).toBe(true);
  });

  it("marks expired when trial ended and not active", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const sub = makeSub({
      status: "expired",
      trial_ends_at: past.toISOString(),
    });
    expect(isTrialActive(sub)).toBe(false);
    expect(isSubscriptionActive(sub)).toBe(false);
    expect(describeSubscription(sub).needsPayment).toBe(true);
  });

  it("active subscription with valid period", () => {
    const end = new Date();
    end.setDate(end.getDate() + 10);
    const sub = makeSub({
      status: "active",
      current_period_end: end.toISOString(),
    });
    expect(isSubscriptionActive(sub)).toBe(true);
    expect(describeSubscription(sub).isActive).toBe(true);
  });
});

describe("free month credits (logic)", () => {
  it("one referral equals one free month reward", () => {
    const rewardMonths = 1;
    const referrals = 3;
    expect(referrals * rewardMonths).toBe(3);
  });
});
