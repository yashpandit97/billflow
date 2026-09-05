"use server";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  SUBSCRIPTION_AMOUNT_MINOR,
  SUBSCRIPTION_CURRENCY,
} from "@/lib/subscription/constants";
import { revalidatePath } from "next/cache";

export type AdminSubscriptionActionResult = {
  error?: string;
  success?: string;
};

async function syncBusinessStatus(
  supabase: Awaited<ReturnType<typeof requirePlatformAdmin>>["supabase"],
  tenantId: string,
  status: string,
  startsAt: string | null,
  endsAt: string | null
) {
  await supabase
    .from("businesses")
    .update({
      subscription_status: status,
      subscription_starts_at: startsAt,
      subscription_ends_at: endsAt,
    })
    .eq("id", tenantId);
}

function revalidateAdmin(tenantId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${tenantId}`);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function grantComplimentarySubscriptionAction(
  tenantId: string
): Promise<AdminSubscriptionActionResult> {
  const { supabase } = await requirePlatformAdmin();
  if (!tenantId) return { error: "Missing tenant" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({
      status: "active",
      is_complimentary: true,
      current_period_start: now,
      current_period_end: null,
      updated_at: now,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message || "Could not grant access" };

  await syncBusinessStatus(supabase, tenantId, "active", now, null);
  revalidateAdmin(tenantId);
  return { success: "Marked as complimentary (subscribed, no charge)" };
}

export async function revokeSubscriptionAction(
  tenantId: string
): Promise<AdminSubscriptionActionResult> {
  const { supabase } = await requirePlatformAdmin();
  if (!tenantId) return { error: "Missing tenant" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({
      status: "expired",
      is_complimentary: false,
      current_period_end: now,
      updated_at: now,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message || "Could not revoke access" };

  await syncBusinessStatus(supabase, tenantId, "expired", null, now);
  revalidateAdmin(tenantId);
  return { success: "Subscription revoked — paywall is active" };
}

export async function recordSubscriptionPaymentAction(
  tenantId: string
): Promise<AdminSubscriptionActionResult> {
  const { supabase } = await requirePlatformAdmin();
  if (!tenantId) return { error: "Missing tenant" };

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);
  const nowIso = now.toISOString();
  const endIso = periodEnd.toISOString();

  const { error: payError } = await supabase.from("subscription_payments").insert({
    tenant_id: tenantId,
    amount: SUBSCRIPTION_AMOUNT_MINOR,
    currency: SUBSCRIPTION_CURRENCY,
    paid_at: nowIso,
    source: "admin",
    note: "Recorded by platform owner",
  });

  if (payError) {
    return { error: payError.message || "Could not record payment" };
  }

  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({
      status: "active",
      is_complimentary: false,
      current_period_start: nowIso,
      current_period_end: endIso,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message || "Payment saved but status update failed" };

  await syncBusinessStatus(supabase, tenantId, "active", nowIso, endIso);
  await supabase.rpc("qualify_referral", { p_referred_tenant_id: tenantId });

  revalidateAdmin(tenantId);
  return { success: "Payment recorded — subscribed for 30 days" };
}
