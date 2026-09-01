"use server";

import { getActiveMembership } from "@/lib/auth/session";
import {
  describeSubscription,
  getTenantSubscription,
  getUnusedCreditMonths,
} from "@/lib/subscription/service";
import {
  formatSubscriptionPrice,
  SUBSCRIPTION_AMOUNT_MAJOR,
} from "@/lib/subscription/constants";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

export async function getSubscriptionOverviewAction() {
  const { supabase, tenantId, business, role } = await getActiveMembership();

  if (role !== "owner" && role !== "admin") {
    return { error: "Only owners and admins can view billing" };
  }

  const [sub, creditMonths, { data: referrals }, { count: successful }, { count: pending }] =
    await Promise.all([
      getTenantSubscription(supabase, tenantId),
      getUnusedCreditMonths(supabase, tenantId),
      supabase
        .from("referrals")
        .select("id, status, created_at, qualified_at")
        .eq("referrer_tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_tenant_id", tenantId)
        .eq("status", "rewarded"),
      supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_tenant_id", tenantId)
        .eq("status", "pending"),
    ]);

  const meta = describeSubscription(sub);
  const referralLink = business.referral_code
    ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/signup?ref=${business.referral_code}`
    : "";

  return {
    plan: "Standard",
    priceLabel: `${formatSubscriptionPrice(business.locale)}/month`,
    amount: SUBSCRIPTION_AMOUNT_MAJOR,
    status: meta.label,
    isTrial: meta.isTrial,
    trialEndsAt: sub?.trial_ends_at
      ? format(new Date(sub.trial_ends_at), "dd MMMM yyyy")
      : null,
    nextBillingDate: sub?.current_period_end
      ? format(new Date(sub.current_period_end), "dd MMMM yyyy")
      : sub?.trial_ends_at
        ? format(new Date(sub.trial_ends_at), "dd MMMM yyyy")
        : null,
    freeMonthsAvailable: creditMonths,
    referralCode: business.referral_code,
    referralLink,
    referrals: referrals ?? [],
    successfulReferrals: successful ?? 0,
    freeMonthsEarned: successful ?? 0,
    pendingReferrals: pending ?? 0,
  };
}

export async function markSubscriptionPaidAction() {
  const { supabase, tenantId, role } = await getActiveMembership();
  if (role !== "owner") {
    return { error: "Only the business owner can manage billing" };
  }

  const now = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({
      status: "active",
      current_period_start: now,
      current_period_end: periodEnd.toISOString(),
      updated_at: now,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: "Could not update subscription" };

  await supabase
    .from("businesses")
    .update({
      subscription_status: "active",
      subscription_starts_at: now,
      subscription_ends_at: periodEnd.toISOString(),
    })
    .eq("id", tenantId);

  await supabase.rpc("qualify_referral", { p_referred_tenant_id: tenantId });

  revalidatePath("/settings");
  return { success: true };
}
