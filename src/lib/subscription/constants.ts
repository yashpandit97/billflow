/** ₹999/month in minor units (paise) — one plan, all features */
export const SUBSCRIPTION_AMOUNT_MINOR = 99900;
export const SUBSCRIPTION_AMOUNT_MAJOR = 999;
export const SUBSCRIPTION_CURRENCY = "INR";

/** Marketing / planned product trial (landing copy). Live trial is platform_settings. */
export const TRIAL_DAYS = 30;

export type TrialDurationUnit = "minutes" | "hours" | "days";

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
  is_complimentary?: boolean;
  created_at: string;
  updated_at: string;
};

export function trialDurationMs(
  value: number,
  unit: TrialDurationUnit
): number {
  const n = Math.max(1, Math.floor(value));
  switch (unit) {
    case "minutes":
      return n * 60_000;
    case "hours":
      return n * 3_600_000;
    case "days":
      return n * 86_400_000;
  }
}

export function formatTrialDuration(
  value: number,
  unit: TrialDurationUnit
): string {
  const n = Math.max(1, Math.floor(value));
  const label =
    unit === "minutes"
      ? n === 1
        ? "minute"
        : "minutes"
      : unit === "hours"
        ? n === 1
          ? "hour"
          : "hours"
        : n === 1
          ? "day"
          : "days";
  return `${n} ${label}`;
}

/** Human-readable remaining trial time (useful for short trials). */
export function formatTrialRemaining(
  trialEndsAt: string | Date,
  now = new Date()
): string | null {
  const end =
    typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const totalHours = Math.floor(ms / 3_600_000);
  const remMin = Math.ceil((ms % 3_600_000) / 60_000);
  if (totalHours < 48) {
    return remMin > 0 && remMin < 60
      ? `${totalHours}h ${remMin}m`
      : `${totalHours}h`;
  }
  const days = Math.ceil(ms / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"}`;
}

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
