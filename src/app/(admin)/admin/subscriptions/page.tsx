import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { subscriptionStatusLabel } from "@/lib/subscription/constants";
import { format } from "date-fns";
import Link from "next/link";

export default async function AdminSubscriptionsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: subs } = await supabase
    .from("tenant_subscriptions")
    .select("*, businesses(name, referral_code)")
    .order("created_at", { ascending: false })
    .limit(200);

  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          ₹299/month per business tenant. One subscription covers all staff users.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Trial ends</th>
              <th className="px-3 py-2 font-medium">Period end</th>
              <th className="px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).map((s) => {
              const biz = s.businesses as { name: string } | { name: string }[] | null;
              const name = Array.isArray(biz) ? biz[0]?.name : biz?.name;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/businesses/${s.tenant_id}`}
                      className="font-medium hover:underline"
                    >
                      {name || "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 capitalize">
                    {subscriptionStatusLabel(s.status)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.trial_ends_at
                      ? format(new Date(s.trial_ends_at), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.current_period_end
                      ? format(new Date(s.current_period_end), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{money(s.amount)}/mo</td>
                </tr>
              );
            })}
            {!subs?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
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
