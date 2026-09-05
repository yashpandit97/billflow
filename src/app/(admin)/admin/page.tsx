import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import {
  formatTrialDuration,
  SUBSCRIPTION_AMOUNT_MINOR,
  type TrialDurationUnit,
} from "@/lib/subscription/constants";
import { isTrialActive, type TenantSubscription } from "@/lib/subscription/constants";
import { startOfMonth } from "date-fns";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const { supabase } = await requirePlatformAdmin();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [
    { data: mrr },
    { count: totalBusinesses },
    { data: recentBiz },
    { count: referralTotal },
    { count: referralRewarded },
    { data: allPayments },
    { data: monthPayments },
    { data: allSubs },
    { data: settings },
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
    supabase.from("subscription_payments").select("amount"),
    supabase
      .from("subscription_payments")
      .select("amount")
      .gte("paid_at", monthStart),
    supabase
      .from("tenant_subscriptions")
      .select("status, trial_ends_at, is_complimentary"),
    supabase
      .from("platform_settings")
      .select("trial_duration_value, trial_duration_unit")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const stats = mrr as {
    paying_businesses?: number;
    complimentary_businesses?: number;
    trial_businesses?: number;
    past_due_businesses?: number;
    churned_businesses?: number;
    mrr_minor?: number;
  } | null;

  const lifetimeEarnings = (allPayments ?? []).reduce((s, p) => s + p.amount, 0);
  const monthEarnings = (monthPayments ?? []).reduce((s, p) => s + p.amount, 0);

  const subs = (allSubs ?? []) as Pick<
    TenantSubscription,
    "status" | "trial_ends_at" | "is_complimentary"
  >[];

  let activeTrials = 0;
  let expiredBlocked = 0;
  for (const s of subs) {
    if (isTrialActive(s as TenantSubscription)) {
      activeTrials += 1;
    } else if (
      s.status === "expired" ||
      s.status === "cancelled" ||
      (s.status === "trialing" && !isTrialActive(s as TenantSubscription)) ||
      s.status === "past_due"
    ) {
      expiredBlocked += 1;
    }
  }

  const paying = stats?.paying_businesses ?? 0;
  const complimentary =
    stats?.complimentary_businesses ??
    subs.filter((s) => s.status === "active" && s.is_complimentary).length;
  const mrrValue = stats?.mrr_minor ?? paying * SUBSCRIPTION_AMOUNT_MINOR;
  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  const trialValue = settings?.trial_duration_value ?? 5;
  const trialUnit = (settings?.trial_duration_unit ??
    "minutes") as TrialDurationUnit;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Platform overview
          </h1>
          <p className="text-sm text-muted-foreground">
            ₹999/month per business · new trials:{" "}
            {formatTrialDuration(trialValue, trialUnit)} · no transaction fees
          </p>
        </div>
        <Link
          href="/admin/settings"
          className="text-sm text-primary hover:underline"
        >
          Edit trial settings →
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Your earnings (subscription payments)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Lifetime collected", value: money(lifetimeEarnings) },
            { label: "This month", value: money(monthEarnings) },
            { label: "Paying businesses", value: String(paying) },
            { label: "Projected MRR", value: money(mrrValue) },
          ].map((k) => (
            <Card key={k.label} className="border-border bg-card shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {k.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-primary">
                {k.value}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total businesses", value: String(totalBusinesses ?? 0) },
          { label: "Active trials", value: String(activeTrials) },
          { label: "Complimentary", value: String(complimentary) },
          { label: "Expired / blocked", value: String(expiredBlocked) },
        ].map((k) => (
          <Card key={k.label} className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{k.value}</CardContent>
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
