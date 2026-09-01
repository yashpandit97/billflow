import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { format } from "date-fns";
import Link from "next/link";

export default async function AdminReferralsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const tenantIds = new Set<string>();
  for (const r of referrals ?? []) {
    tenantIds.add(r.referrer_tenant_id);
    tenantIds.add(r.referred_tenant_id);
  }

  const { data: bizNames } = tenantIds.size
    ? await supabase
        .from("businesses")
        .select("id, name")
        .in("id", [...tenantIds])
    : { data: [] as { id: string; name: string }[] };

  const nameById = new Map((bizNames ?? []).map((b) => [b.id, b.name]));

  const [{ data: topReferrerRows }] = await Promise.all([
    supabase.from("referrals").select("referrer_tenant_id").eq("status", "rewarded"),
  ]);

  const counts = new Map<string, number>();
  for (const r of topReferrerRows ?? []) {
    counts.set(r.referrer_tenant_id, (counts.get(r.referrer_tenant_id) ?? 0) + 1);
  }

  const { data: businesses } = counts.size
    ? await supabase
        .from("businesses")
        .select("id, name")
        .in("id", [...counts.keys()])
    : { data: [] as { id: string; name: string }[] };

  const top = [...counts.entries()]
    .map(([id, n]) => ({
      name: businesses?.find((b) => b.id === id)?.name ?? id.slice(0, 8),
      id,
      count: n,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const statusCounts = {
    pending: (referrals ?? []).filter((r) => r.status === "pending").length,
    qualified: (referrals ?? []).filter((r) => r.status === "qualified").length,
    rewarded: (referrals ?? []).filter((r) => r.status === "rewarded").length,
    rejected: (referrals ?? []).filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="text-sm text-muted-foreground">
          1 free month per qualified referred business.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(statusCounts).map(([k, v]) => (
          <Card key={k} className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize text-muted-foreground">
                {k}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{v}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Top referrers</CardTitle>
        </CardHeader>
        <CardContent>
          {!top.length ? (
            <p className="text-sm text-muted-foreground">No rewarded referrals yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Business</th>
                  <th className="pb-2 font-medium">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2">
                      <Link
                        href={`/admin/businesses/${t.id}`}
                        className="hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-2">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Referrer</th>
              <th className="px-3 py-2 font-medium">Referred</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(referrals ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {nameById.get(r.referrer_tenant_id) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {nameById.get(r.referred_tenant_id) || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.referral_code}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
