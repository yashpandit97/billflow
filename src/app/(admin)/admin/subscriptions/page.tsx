import { AdminSubscriptionActions } from "@/components/admin/admin-subscription-actions";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import {
  isTrialActive,
  subscriptionStatusLabel,
  type TenantSubscription,
} from "@/lib/subscription/constants";
import { format } from "date-fns";
import Link from "next/link";

export default async function AdminSubscriptionsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: subs } = await supabase
    .from("tenant_subscriptions")
    .select("*, businesses(name, referral_code)")
    .order("created_at", { ascending: false })
    .limit(200);

  const tenantIds = (subs ?? []).map((s) => s.tenant_id);
  const { data: owners } = tenantIds.length
    ? await supabase
        .from("business_members")
        .select("business_id, profiles(full_name)")
        .in("business_id", tenantIds)
        .eq("role", "owner")
    : { data: [] as { business_id: string; profiles: unknown }[] };

  const ownerByTenant = new Map<string, string>();
  for (const o of owners ?? []) {
    const profile = o.profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const name = Array.isArray(profile)
      ? profile[0]?.full_name
      : profile?.full_name;
    if (name) ownerByTenant.set(o.business_id, name);
  }

  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          ₹999/month per business. Grant complimentary access or record payments.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Trial / period</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).map((s) => {
              const biz = s.businesses as
                | { name: string }
                | { name: string }[]
                | null;
              const name = Array.isArray(biz) ? biz[0]?.name : biz?.name;
              const sub = s as TenantSubscription;
              const trial = isTrialActive(sub);
              const label = s.is_complimentary
                ? "Complimentary"
                : subscriptionStatusLabel(s.status);

              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/businesses/${s.tenant_id}`}
                      className="font-medium hover:underline"
                    >
                      {name || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ownerByTenant.get(s.tenant_id) || "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {trial ? (
                      format(new Date(s.trial_ends_at), "dd MMM yyyy HH:mm")
                    ) : s.current_period_end ? (
                      format(new Date(s.current_period_end), "dd MMM yyyy")
                    ) : s.is_complimentary ? (
                      "Unlimited"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{money(s.amount)}/mo</td>
                  <td className="px-3 py-2">
                    <AdminSubscriptionActions
                      tenantId={s.tenant_id}
                      status={s.status}
                      isComplimentary={!!s.is_complimentary}
                    />
                  </td>
                </tr>
              );
            })}
            {!subs?.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No subscriptions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
