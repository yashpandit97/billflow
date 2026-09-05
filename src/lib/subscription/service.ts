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
      canUseApp: false,
      isTrial: false,
      isActive: false,
      isComplimentary: false,
      needsPayment: true,
      label: "Unknown",
      trialEndsAt: null as string | null,
      periodEnd: null as string | null,
    };
  }
  const now = new Date();
  const trial = isTrialActive(sub, now);
  const active = isSubscriptionActive(sub, now);
  const complimentary = !!sub.is_complimentary && sub.status === "active";
  // Paid or complimentary active, or still-open trial. Expired trialing counts as blocked.
  const canUseApp = trial || (sub.status === "active" && active);
  const needsPayment =
    !canUseApp &&
    (sub.status === "past_due" ||
      sub.status === "expired" ||
      (sub.status === "trialing" && !trial) ||
      (sub.status === "active" && !active));

  return {
    canUseApp,
    isTrial: trial,
    isActive: sub.status === "active" && active,
    isComplimentary: complimentary,
    needsPayment,
    label: complimentary
      ? "complimentary"
      : trial
        ? "trialing"
        : !canUseApp && sub.status === "trialing"
          ? "expired"
          : sub.status,
    trialEndsAt: sub.trial_ends_at,
    periodEnd: sub.current_period_end,
  };
}

export async function assertTenantCanUseApp(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sub = await getTenantSubscription(supabase, tenantId);
  const meta = describeSubscription(sub);
  if (!meta.canUseApp) {
    return {
      ok: false,
      error:
        "Your free trial has ended. Subscribe to BillMoney (₹999/month) to continue.",
    };
  }
  return { ok: true };
}
