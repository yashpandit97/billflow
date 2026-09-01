import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { SUBSCRIPTION_AMOUNT_MINOR } from "@/lib/subscription/constants";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const { supabase } = await requirePlatformAdmin();

  const [
    { data: mrr },
    { count: totalBusinesses },
    { data: recentBiz },
    { count: referralTotal },
    { count: referralRewarded },
  ] = await Promise.all([
    supabase.from("subscription_mrr_v").select("*").maybeSingle(),
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase
      .from("businesses")
      .select("id, name, created_at, subscription_status")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("referrals").select("*", { count: "exact", head: true }),
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("status", "rewarded"),
  ]);

  const stats = mrr as {
    paying_businesses?: number;
    trial_businesses?: number;
    past_due_businesses?: number;
    churned_businesses?: number;
    mrr_minor?: number;
  } | null;

  const mrrValue = stats?.mrr_minor ?? 0;
  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          ₹299/month per business · 30-day free trial · no transaction fees
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total businesses", value: String(totalBusinesses ?? 0) },
          { label: "Trial businesses", value: String(stats?.trial_businesses ?? 0) },
          { label: "Paying businesses", value: String(stats?.paying_businesses ?? 0) },
          { label: "MRR", value: money(mrrValue) },
        ].map((k) => (
          <Card key={k.label} className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-primary">
              {k.value}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Past due", value: String(stats?.past_due_businesses ?? 0) },
          { label: "Churned / expired", value: String(stats?.churned_businesses ?? 0) },
          {
            label: "Plan price",
            value: money(SUBSCRIPTION_AMOUNT_MINOR),
          },
        ].map((k) => (
          <Card key={k.label} className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{k.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Referrals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total referrals: {referralTotal ?? 0}</p>
            <p>Successful (rewarded): {referralRewarded ?? 0}</p>
            <Link href="/admin/referrals" className="text-primary hover:underline">
              View referral dashboard →
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Recent businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(recentBiz ?? []).map((b) => (
                <li key={b.id} className="flex justify-between gap-2">
                  <Link
                    href={`/admin/businesses/${b.id}`}
                    className="font-medium hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="capitalize text-muted-foreground">
                    {b.subscription_status}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
