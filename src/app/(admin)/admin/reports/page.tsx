import { AdminCharts } from "@/components/admin/admin-charts";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { SUBSCRIPTION_AMOUNT_MINOR } from "@/lib/subscription/constants";
import {
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import Link from "next/link";

function resolveRange(preset?: string, from?: string, to?: string) {
  const now = new Date();
  if (from && to) {
    return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
  }
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return {
        start: startOfMonth(last),
        end: endOfDay(new Date(last.getFullYear(), last.getMonth() + 1, 0)),
      };
    }
    case "month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "30d":
    default:
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformAdmin();
  const { start, end } = resolveRange(params.preset, params.from, params.to);

  const [{ data: bills }, { data: businesses }, { data: referrals }, { data: mrr }] =
    await Promise.all([
      supabase
        .from("bills")
        .select("total, created_at, status, tenant_id")
        .eq("status", "paid")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("businesses")
        .select("created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("referrals")
        .select("created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase.from("subscription_mrr_v").select("*").maybeSingle(),
    ]);

  const days = eachDayOfInterval({ start, end });
  const series = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayBills = (bills ?? []).filter(
      (b) => format(new Date(b.created_at), "yyyy-MM-dd") === key
    );
    const dayBiz = (businesses ?? []).filter(
      (b) => format(new Date(b.created_at), "yyyy-MM-dd") === key
    );
    const dayReferrals = (referrals ?? []).filter(
      (r) => format(new Date(r.created_at), "yyyy-MM-dd") === key
    );
    const activeBusinesses = new Set(dayBills.map((b) => b.tenant_id)).size;
    return {
      date: format(day, "dd MMM"),
      billVolume: dayBills.reduce((s, b) => s + b.total, 0) / 100,
      referralSignups: dayReferrals.length,
      newBusinesses: dayBiz.length,
      activeBusinesses,
    };
  });

  const volume = (bills ?? []).reduce((s, b) => s + b.total, 0);
  const activeInRange = new Set((bills ?? []).map((b) => b.tenant_id)).size;
  const payingBusinesses = mrr?.paying_businesses ?? 0;
  const mrrMinor = mrr?.mrr_minor ?? payingBusinesses * SUBSCRIPTION_AMOUNT_MINOR;
  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  const presets = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "month", label: "This month" },
    { key: "last_month", label: "Last month" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Platform analytics for the selected period.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Link
            key={p.key}
            href={`/admin/reports?preset=${p.key}`}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          type="date"
          name="from"
          defaultValue={params.from}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={params.to}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Custom range
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Bill volume (range)</p>
          <p className="text-xl font-semibold text-primary">{money(volume)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">MRR (current)</p>
          <p className="text-xl font-semibold text-primary">{money(mrrMinor)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">New businesses</p>
          <p className="text-xl font-semibold text-primary">
            {businesses?.length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active in range</p>
          <p className="text-xl font-semibold text-primary">{activeInRange}</p>
        </div>
      </div>

      <AdminCharts series={series} />
    </div>
  );
}
