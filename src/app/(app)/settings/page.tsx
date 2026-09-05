import { SettingsClient } from "@/components/settings/settings-client";
import { getWhatsAppSendAvailability } from "@/app/actions/whatsapp-settings";
import { getSubscriptionOverviewAction } from "@/app/actions/subscription";
import { getActiveMembership, getProfile } from "@/lib/auth/session";
import {
  describeSubscription,
  getTenantSubscription,
} from "@/lib/subscription/service";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const { supabase, tenantId, business, user, role } = await getActiveMembership();
  const profile = await getProfile();
  const sub = await getTenantSubscription(supabase, tenantId);
  const meta = describeSubscription(sub);
  const billingOnly = !meta.canUseApp;

  const [
    { data: members },
    { count: billCount },
    { data: paymentSettings },
    { data: tables },
    whatsappAvailability,
    subscriptionOverview,
  ] = await Promise.all([
    supabase
      .from("business_members")
      .select("*, profiles(*)")
      .eq("business_id", tenantId),
    supabase
      .from("bills")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("payment_settings")
      .select("*")
      .eq("business_id", tenantId)
      .maybeSingle(),
    supabase
      .from("dining_tables")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    getWhatsAppSendAvailability(),
    role === "owner" || role === "admin"
      ? getSubscriptionOverviewAction()
      : Promise.resolve(null),
  ]);

  const requestedTab = params.tab;
  const defaultTab =
    billingOnly || requestedTab === "billing"
      ? canManageBillingTab(role)
        ? "billing"
        : "account"
      : requestedTab &&
          [
            "profile",
            "billing",
            "branding",
            "payment",
            "invoice",
            "whatsapp",
            "tax",
            "account",
          ].includes(requestedTab)
        ? requestedTab
        : "profile";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-6 md:pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {billingOnly
            ? "Your plan status and referrals. Activate to unlock the rest of the app."
            : "Business profile, billing, payments, invoices, and account."}
        </p>
      </div>
      <SettingsClient
        business={business}
        members={members ?? []}
        profile={profile}
        billCount={billCount ?? 0}
        userEmail={user.email ?? ""}
        paymentSettings={paymentSettings}
        tables={tables ?? []}
        cloudApiReady={whatsappAvailability.cloudApiReady}
        subscriptionOverview={
          subscriptionOverview && !("error" in subscriptionOverview)
            ? subscriptionOverview
            : null
        }
        canManageBilling={role === "owner" || role === "admin"}
        defaultTab={defaultTab}
        billingOnly={billingOnly}
      />
    </div>
  );
}

function canManageBillingTab(role: string) {
  return role === "owner" || role === "admin";
}
