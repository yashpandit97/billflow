import { AdminSubscriptionActions } from "@/components/admin/admin-subscription-actions";
import { BusinessTrendCharts } from "@/components/admin/admin-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { formatSubscriptionPrice } from "@/lib/subscription/constants";
import {
  eachDayOfInterval,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requirePlatformAdmin();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const since30 = subDays(now, 30).toISOString();
  const chartStart = startOfDay(subDays(now, 29));

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!business) notFound();

  const [
    { data: bills },
    { data: subscription },
    { data: owner },
    { count: customerCount },
    { count: productCount },
    { count: billsThisMonth },
    { data: recentBills },
    { count: referralCount },
  ] = await Promise.all([
    supabase
      .from("bills")
      .select("id, invoice_number, total, created_at, status")
      .eq("tenant_id", id)
      .eq("status", "paid")
      .order("created_at", { ascending: true }),
    supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", id)
      .maybeSingle(),
    supabase
      .from("business_members")
      .select("profiles(full_name)")
      .eq("business_id", id)
      .eq("role", "owner")
      .maybeSingle(),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", id),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", id),
    supabase
      .from("bills")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", id)
      .eq("status", "paid")
      .gte("created_at", monthStart),
    supabase
      .from("bills")
      .select("id, invoice_number, total, status, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_tenant_id", id)
      .eq("status", "rewarded"),
  ]);

  const volume = (bills ?? []).reduce((s, b) => s + b.total, 0);
  const avg = bills?.length ? Math.round(volume / bills.length) : 0;
  const money = (n: number) =>
    formatCurrency(n, { code: business.currency, locale: business.locale });

  const lastActivity = bills?.length
    ? bills[bills.length - 1]!.created_at
    : business.created_at;
  const isActive =
    new Date(lastActivity).getTime() >= new Date(since30).getTime();

  const profile = owner?.profiles as
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
    | undefined;
  const ownerName = Array.isArray(profile)
    ? profile[0]?.full_name
    : profile?.full_name;

  const days = eachDayOfInterval({ start: chartStart, end: now });
  const trend = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayBills = (bills ?? []).filter(
      (b) => format(new Date(b.created_at), "yyyy-MM-dd") === key
    );
    return {
      date: format(day, "dd MMM"),
      billVolume: dayBills.reduce((s, b) => s + b.total, 0) / 100,
      billCount: dayBills.length,
    };
  });

  const subStatus = subscription?.is_complimentary
    ? "Complimentary"
    : (subscription?.status ?? business.subscription_status);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {business.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform analytics and subscription controls for this business.
          </p>
        </div>
        <Link
          href="/admin/businesses"
          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
        >
          Back
        </Link>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Business information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Owner</p>
            <p className="font-medium">{ownerName || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium capitalize">
              {isActive ? "Active (30d)" : "Inactive"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Subscription</p>
            <p className="font-medium capitalize">{subStatus}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Plan</p>
            <p className="font-medium">{formatSubscriptionPrice()}/month</p>
          </div>
          <div>
            <p className="text-muted-foreground">Referral code</p>
            <p className="font-mono font-medium">
              {business.referral_code || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Successful referrals</p>
            <p className="font-medium">{referralCount ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p>{business.phone || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p>{business.email || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {subscription ? (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Subscription controls</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminSubscriptionActions
              tenantId={id}
              status={subscription.status}
              isComplimentary={!!subscription.is_complimentary}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total bill volume", value: money(volume) },
          { label: "Paid invoices", value: String(bills?.length ?? 0) },
          { label: "Avg invoice", value: money(avg) },
          { label: "This month", value: String(billsThisMonth ?? 0) },
        ].map((s) => (
          <Card key={s.label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <BusinessTrendCharts series={trend} />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {(recentBills ?? []).map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <span>{b.invoice_number || b.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">
                  {format(new Date(b.created_at), "dd MMM yyyy")} ·{" "}
                  {money(b.total)}
                </span>
              </li>
            ))}
            {!recentBills?.length ? (
              <li className="py-4 text-center text-muted-foreground">
                No invoices yet.
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Customers</p>
            <p className="text-xl font-semibold">{customerCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Products</p>
            <p className="text-xl font-semibold">{productCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
