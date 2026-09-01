import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSubscriptionActive,
  isTrialActive,
  type TenantSubscription,
} from "@/lib/subscription/constants";

export async function getTenantSubscription(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantSubscription | null> {
  const { data } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data as TenantSubscription | null;
}

export async function getUnusedCreditMonths(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { data } = await supabase
    .from("subscription_credits")
    .select("months")
    .eq("tenant_id", tenantId)
    .is("used_at", null);
  return (data ?? []).reduce((s, c) => s + c.months, 0);
}

export function describeSubscription(sub: TenantSubscription | null) {
  if (!sub) {
    return {
      canUseApp: true,
      isTrial: false,
      isActive: false,
      needsPayment: false,
      label: "Unknown",
    };
  }
  const now = new Date();
  const trial = isTrialActive(sub, now);
  const active = isSubscriptionActive(sub, now);
  return {
    canUseApp: trial || active || sub.status === "past_due",
    isTrial: trial,
    isActive: sub.status === "active",
    needsPayment: sub.status === "past_due" || sub.status === "expired",
    label: sub.status,
    trialEndsAt: sub.trial_ends_at,
    periodEnd: sub.current_period_end,
  };
}
