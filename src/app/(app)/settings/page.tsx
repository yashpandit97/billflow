import { SettingsClient } from "@/components/settings/settings-client";
import { getWhatsAppSettingsPublic } from "@/app/actions/whatsapp-settings";
import { getSubscriptionOverviewAction } from "@/app/actions/subscription";
import { getActiveMembership, getProfile } from "@/lib/auth/session";

export default async function SettingsPage() {
  const { supabase, tenantId, business, user, role } = await getActiveMembership();
  const profile = await getProfile();

  const [
    { data: members },
    { count: billCount },
    { data: paymentSettings },
    { data: tables },
    whatsappSettings,
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
    getWhatsAppSettingsPublic(),
    role === "owner" || role === "admin"
      ? getSubscriptionOverviewAction()
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-6 md:pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business profile, billing, referrals, payments, invoices, and account.
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
        whatsappSettings={whatsappSettings}
        subscriptionOverview={
          subscriptionOverview && !("error" in subscriptionOverview)
            ? subscriptionOverview
            : null
        }
        canManageBilling={role === "owner" || role === "admin"}
      />
    </div>
  );
}
