import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { format } from "date-fns";
import Link from "next/link";

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { supabase } = await requirePlatformAdmin();

  let query = supabase
    .from("businesses")
    .select("id, name, email, phone, created_at, subscription_status, referral_code")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: businesses } = await query;

  const ids = (businesses ?? []).map((b) => b.id);

  const [{ data: bills }, { data: subscriptions }, { data: owners }] = await Promise.all([
    ids.length
      ? supabase
          .from("bills")
          .select("tenant_id, total, status, created_at")
          .in("tenant_id", ids)
          .eq("status", "paid")
      : Promise.resolve({ data: [] as { tenant_id: string; total: number; status: string; created_at: string }[] }),
    ids.length
      ? supabase
          .from("tenant_subscriptions")
          .select("tenant_id, status, trial_ends_at, current_period_end")
          .in("tenant_id", ids)
      : Promise.resolve({ data: [] as { tenant_id: string; status: string; trial_ends_at: string; current_period_end: string | null }[] }),
    ids.length
      ? supabase
          .from("business_members")
          .select("business_id, role, profiles(full_name)")
          .in("business_id", ids)
          .eq("role", "owner")
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const money = (n: number) => formatCurrency(n, { code: "INR", locale: "en-IN" });

  const rows = (businesses ?? []).map((b) => {
    const tenantBills = (bills ?? []).filter((x) => x.tenant_id === b.id);
    const volume = tenantBills.reduce((s, x) => s + x.total, 0);
    const sub = (subscriptions ?? []).find((s) => s.tenant_id === b.id);
    const last = tenantBills
      .map((x) => x.created_at)
      .sort()
      .at(-1);
    const ownerRow = (owners as { business_id: string; profiles?: { full_name: string } | { full_name: string }[] | null }[] | null)?.find(
      (o) => o.business_id === b.id
    );
    const profile = ownerRow?.profiles;
    const ownerName = Array.isArray(profile)
      ? profile[0]?.full_name
      : profile?.full_name;

    return {
      ...b,
      billCount: tenantBills.length,
      volume,
      subscriptionStatus: sub?.status ?? b.subscription_status,
      last,
      ownerName,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
        <p className="text-sm text-muted-foreground">
          Directory of tenant businesses (read-only analytics).
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search businesses…"
          className="h-8 max-w-sm flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Owner</th>
              <th className="px-3 py-2 font-medium">Subscription</th>
              <th className="px-3 py-2 font-medium">Bills</th>
              <th className="px-3 py-2 font-medium">Bill volume</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/businesses/${r.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM yyyy")}
                  </p>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  {r.ownerName || "—"}
                </td>
                <td className="px-3 py-2 capitalize">{r.subscriptionStatus}</td>
                <td className="px-3 py-2">{r.billCount}</td>
                <td className="px-3 py-2">{money(r.volume)}</td>
                <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                  {r.last ? format(new Date(r.last), "dd MMM yyyy") : "—"}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No businesses found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
