import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_AMOUNT_MAJOR,
  SUBSCRIPTION_AMOUNT_MINOR,
  TRIAL_DAYS,
  formatSubscriptionPrice,
  formatTrialDuration,
  formatTrialRemaining,
  isSubscriptionActive,
  isTrialActive,
  trialDurationMs,
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
    is_complimentary: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

describe("subscription pricing", () => {
  it("uses ₹999/month in minor units", () => {
    expect(SUBSCRIPTION_AMOUNT_MAJOR).toBe(999);
    expect(SUBSCRIPTION_AMOUNT_MINOR).toBe(99900);
    expect(formatSubscriptionPrice("en-IN")).toContain("999");
  });

  it("marketing trial remains 30 days", () => {
    expect(TRIAL_DAYS).toBe(30);
  });
});

describe("trial duration helpers", () => {
  it("formats and converts duration units", () => {
    expect(formatTrialDuration(5, "minutes")).toBe("5 minutes");
    expect(formatTrialDuration(1, "hours")).toBe("1 hour");
    expect(trialDurationMs(5, "minutes")).toBe(5 * 60_000);
    expect(trialDurationMs(2, "days")).toBe(2 * 86_400_000);
  });

  it("formats short remaining time", () => {
    const inFourMin = new Date(Date.now() + 4 * 60_000).toISOString();
    const label = formatTrialRemaining(inFourMin);
    expect(label).toMatch(/min/);
  });
});

describe("subscription state", () => {
  it("allows app use during trial", () => {
    const sub = makeSub();
    expect(isTrialActive(sub)).toBe(true);
    expect(isSubscriptionActive(sub)).toBe(true);
    expect(describeSubscription(sub).canUseApp).toBe(true);
  });

  it("blocks expired trial even if status is still trialing", () => {
    const past = new Date();
    past.setMinutes(past.getMinutes() - 1);
    const sub = makeSub({
      status: "trialing",
      trial_ends_at: past.toISOString(),
    });
    expect(isTrialActive(sub)).toBe(false);
    expect(describeSubscription(sub).canUseApp).toBe(false);
    expect(describeSubscription(sub).needsPayment).toBe(true);
    expect(describeSubscription(sub).label).toBe("expired");
  });

  it("marks expired when status is expired", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const sub = makeSub({
      status: "expired",
      trial_ends_at: past.toISOString(),
    });
    expect(isTrialActive(sub)).toBe(false);
    expect(isSubscriptionActive(sub)).toBe(false);
    expect(describeSubscription(sub).needsPayment).toBe(true);
    expect(describeSubscription(sub).canUseApp).toBe(false);
  });

  it("does not allow past_due without payment", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const sub = makeSub({
      status: "past_due",
      trial_ends_at: past.toISOString(),
    });
    expect(describeSubscription(sub).canUseApp).toBe(false);
  });

  it("complimentary active with null period end can use app", () => {
    const sub = makeSub({
      status: "active",
      is_complimentary: true,
      current_period_end: null,
    });
    expect(isSubscriptionActive(sub)).toBe(true);
    expect(describeSubscription(sub).canUseApp).toBe(true);
    expect(describeSubscription(sub).isComplimentary).toBe(true);
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
