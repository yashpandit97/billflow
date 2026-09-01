import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getActiveMembership } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/currency/format";
import {
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import Link from "next/link";

type CustomerJoin = { name: string; phone: string | null } | null;

function customerFromJoin(
  customers: CustomerJoin | CustomerJoin[] | undefined
): { name: string; phone: string | null } {
  const row = Array.isArray(customers) ? customers[0] : customers;
  return {
    name: row?.name || "Walk-in",
    phone: row?.phone ?? null,
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const params = await searchParams;
  const { supabase, tenantId, business } = await getActiveMembership();
  const now = new Date();

  let rangeFrom = params.from ? startOfDay(new Date(params.from)) : startOfMonth(now);
  let rangeTo = params.to ? endOfDay(new Date(params.to)) : endOfDay(now);

  switch (params.preset) {
    case "today":
      rangeFrom = startOfDay(now);
      rangeTo = endOfDay(now);
      break;
    case "yesterday": {
      const y = subDays(now, 1);
      rangeFrom = startOfDay(y);
      rangeTo = endOfDay(y);
      break;
    }
    case "week":
      rangeFrom = startOfWeek(now, { weekStartsOn: 1 });
      rangeTo = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "month":
      rangeFrom = startOfMonth(now);
      rangeTo = endOfDay(now);
      break;
    case "last_month": {
      const last = subMonths(now, 1);
      rangeFrom = startOfMonth(last);
      rangeTo = endOfDay(new Date(last.getFullYear(), last.getMonth() + 1, 0));
      break;
    }
  }

  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const [
    { data: rangeBills },
    { data: today },
    { data: week },
    { data: month },
  ] = await Promise.all([
    supabase
      .from("bills")
      .select(
        "id, invoice_number, total, status, created_at, payment_method, customers(name, phone)"
      )
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", rangeFrom.toISOString())
      .lte("created_at", rangeTo.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("bills")
      .select("total")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd),
    supabase
      .from("bills")
      .select("total")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", weekStart)
      .lte("created_at", weekEnd),
    supabase
      .from("bills")
      .select("total")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("created_at", monthStart),
  ]);

  const sum = (rows: { total: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + r.total, 0);

  const rangeSales = sum(rangeBills);
  const invoiceCount = rangeBills?.length ?? 0;
  const avg = invoiceCount ? Math.round(rangeSales / invoiceCount) : 0;

  const byMethod = new Map<string, { count: number; total: number }>();
  for (const b of rangeBills ?? []) {
    const key = b.payment_method || "unspecified";
    const cur = byMethod.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += b.total;
    byMethod.set(key, cur);
  }

  const billIds = (rangeBills ?? []).map((b) => b.id);
  let topProducts: { name: string; qty: number; revenue: number }[] = [];

  if (billIds.length) {
    const { data: items } = await supabase
      .from("bill_items")
      .select("product_name, quantity, line_total")
      .eq("tenant_id", tenantId)
      .in("bill_id", billIds);

    const map = new Map<string, { qty: number; revenue: number }>();
    for (const item of items ?? []) {
      const cur = map.get(item.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(item.quantity);
      cur.revenue += item.line_total;
      map.set(item.product_name, cur);
    }
    topProducts = [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }

  const money = (n: number) =>
    formatCurrency(n, { code: business.currency, locale: business.locale });

  const fromValue = rangeFrom.toISOString().slice(0, 10);
  const toValue = rangeTo.toISOString().slice(0, 10);

  const presets = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "last_month", label: "Last month" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Sales insights for your business only.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={`/reports?preset=${p.key}`}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form
        key={`${fromValue}-${toValue}`}
        className="flex flex-wrap items-end gap-2"
      >
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={fromValue} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={toValue} className="w-40" />
        </div>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Apply
        </button>
        <Link
          href={`/reports?from=${subDays(now, 7).toISOString().slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`}
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm"
        >
          Last 7 days
        </Link>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sales today</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(sum(today))}</CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sales this week</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(sum(week))}</CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sales this month</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(sum(month))}</CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Range sales</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(rangeSales)}</CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Invoice count</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{invoiceCount}</CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Average invoice</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(avg)}</CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Invoices in range</CardTitle>
        </CardHeader>
        <CardContent>
          {!rangeBills?.length ? (
            <p className="text-sm text-muted-foreground">
              No completed invoices in this range yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">
                      Phone
                    </th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">
                      Payment
                    </th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeBills.map((bill) => {
                    const customer = customerFromJoin(
                      bill.customers as CustomerJoin | CustomerJoin[] | undefined
                    );
                    return (
                      <tr key={bill.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Link
                            href={`/bills/${bill.id}`}
                            className="font-medium hover:underline"
                          >
                            {bill.invoice_number || "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {format(new Date(bill.created_at), "dd MMM yyyy")}
                        </td>
                        <td className="px-3 py-2">{customer.name}</td>
                        <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                          {customer.phone || "—"}
                        </td>
                        <td className="hidden px-3 py-2 capitalize text-muted-foreground md:table-cell">
                          {bill.payment_method?.replace("_", " ") || "—"}
                        </td>
                        <td className="px-3 py-2">{money(bill.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Sales by payment method</CardTitle>
        </CardHeader>
        <CardContent>
          {!byMethod.size ? (
            <p className="text-sm text-muted-foreground">No data in range.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Invoices</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byMethod.entries()].map(([method, v]) => (
                    <tr key={method} className="border-t border-border">
                      <td className="px-3 py-2 capitalize">
                        {method.replace("_", " ")}
                      </td>
                      <td className="px-3 py-2">{v.count}</td>
                      <td className="px-3 py-2">{money(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Top-selling products</CardTitle>
        </CardHeader>
        <CardContent>
          {!topProducts.length ? (
            <p className="text-sm text-muted-foreground">
              No completed invoices in this range yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Qty sold</th>
                    <th className="px-3 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2">{p.qty}</td>
                      <td className="px-3 py-2">{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
