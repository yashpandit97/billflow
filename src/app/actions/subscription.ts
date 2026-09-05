"use server";

import { getActiveMembership } from "@/lib/auth/session";
import {
  describeSubscription,
  getTenantSubscription,
  getUnusedCreditMonths,
} from "@/lib/subscription/service";
import {
  formatSubscriptionPrice,
  formatTrialRemaining,
  SUBSCRIPTION_AMOUNT_MAJOR,
} from "@/lib/subscription/constants";
import { format } from "date-fns";

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

  const trialRemaining =
    meta.isTrial && sub?.trial_ends_at
      ? formatTrialRemaining(sub.trial_ends_at)
      : null;

  return {
    plan: "Standard",
    priceLabel: `${formatSubscriptionPrice(business.locale)}/month`,
    amount: SUBSCRIPTION_AMOUNT_MAJOR,
    status: meta.label,
    isTrial: meta.isTrial,
    isComplimentary: meta.isComplimentary,
    needsPayment: meta.needsPayment,
    trialRemaining,
    trialEndsAt: sub?.trial_ends_at
      ? format(new Date(sub.trial_ends_at), "dd MMMM yyyy HH:mm")
      : null,
    nextBillingDate: sub?.current_period_end
      ? format(new Date(sub.current_period_end), "dd MMMM yyyy")
      : meta.isTrial && sub?.trial_ends_at
        ? format(new Date(sub.trial_ends_at), "dd MMMM yyyy HH:mm")
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

