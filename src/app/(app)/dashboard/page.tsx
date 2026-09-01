import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveMembership } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/currency/format";
import { endOfDay, format, startOfDay, startOfMonth } from "date-fns";
import { Package, Receipt, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const { supabase, tenantId, business } = await getActiveMembership();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const [
    { data: todayBills },
    { data: monthBills },
    { count: productCount },
    { data: recent },
    { data: subscription },
  ] = await Promise.all([
    supabase
      .from("bills")
      .select("total, status")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd),
    supabase
      .from("bills")
      .select("total, status")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", monthStart),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("bills")
      .select("id, invoice_number, total, status, created_at, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("tenant_subscriptions")
      .select("status, trial_ends_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const todaySales = (todayBills ?? []).reduce((s, b) => s + b.total, 0);
  const monthSales = (monthBills ?? []).reduce((s, b) => s + b.total, 0);
  const todayCount = todayBills?.length ?? 0;

  const money = (n: number) =>
    formatCurrency(n, { code: business.currency, locale: business.locale });

  const trialEnds =
    subscription?.trial_ends_at && subscription.status === "trialing"
      ? format(new Date(subscription.trial_ends_at), "dd MMM yyyy")
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 sm:space-y-6 sm:p-6 md:pb-6">
      <div>
        <p className="text-sm text-muted-foreground">{business.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      {trialEnds ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Free trial until <strong>{trialEnds}</strong>. Then ₹299/month for your
          whole team.
        </div>
      ) : null}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Today&apos;s sales</p>
            <p className="text-3xl font-bold tracking-tight text-primary">
              {money(todaySales)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {todayCount} invoice{todayCount === 1 ? "" : "s"} today
            </p>
          </div>
          <Link
            href="/billing"
            className="inline-flex h-12 min-w-[12rem] items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            + Create Bill
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "This month", value: money(monthSales), icon: Receipt },
          { label: "Products", value: String(productCount ?? 0), icon: Package },
          { label: "Quick action", value: "New bill", icon: ShoppingCart, href: "/billing" },
          { label: "Reports", value: "View", icon: Receipt, href: "/reports" },
        ].map((stat) => {
          const Icon = stat.icon;
          const inner = (
            <Card className="h-full shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
                  {stat.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold sm:text-xl">{stat.value}</p>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent bills</CardTitle>
          <Link href="/bills" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {!recent?.length ? (
            <EmptyState
              icon={Receipt}
              title="No bills yet"
              description="Create your first invoice from the button above."
              actionLabel="Create bill"
              actionHref="/billing"
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((bill) => {
                const customer = bill.customers as
                  | { name: string }
                  | { name: string }[]
                  | null;
                const customerName = Array.isArray(customer)
                  ? customer[0]?.name
                  : customer?.name;
                return (
                  <li key={bill.id}>
                    <Link
                      href={`/bills/${bill.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {bill.invoice_number || "Draft"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {customerName || "Walk-in"} ·{" "}
                          {format(new Date(bill.created_at), "dd MMM, HH:mm")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold">{money(bill.total)}</p>
                        <Badge variant="secondary" className="mt-0.5 capitalize">
                          {bill.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
