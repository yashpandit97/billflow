/** ₹999/month in minor units (paise) — one plan, all features */
export const SUBSCRIPTION_AMOUNT_MINOR = 99900;
export const SUBSCRIPTION_AMOUNT_MAJOR = 999;
export const SUBSCRIPTION_CURRENCY = "INR";
export const TRIAL_DAYS = 30;

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "none";

export type TenantSubscription = {
  id: string;
  tenant_id: string;
  status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export function isTrialActive(sub: TenantSubscription, now = new Date()): boolean {
  return (
    sub.status === "trialing" &&
    new Date(sub.trial_ends_at).getTime() > now.getTime()
  );
}

export function isSubscriptionActive(
  sub: TenantSubscription,
  now = new Date()
): boolean {
  if (isTrialActive(sub, now)) return true;
  if (sub.status === "active") {
    if (!sub.current_period_end) return true;
    return new Date(sub.current_period_end).getTime() > now.getTime();
  }
  return false;
}

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "trialing":
      return "Trial";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return "None";
  }
}

export function formatSubscriptionPrice(locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: SUBSCRIPTION_CURRENCY,
    maximumFractionDigits: 0,
  }).format(SUBSCRIPTION_AMOUNT_MAJOR);
}
