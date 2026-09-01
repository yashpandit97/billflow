import { requirePlatformAdmin } from "@/lib/auth/admin";
import { format } from "date-fns";

export default async function AdminUsersPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const userIds = (profiles ?? []).map((p) => p.id);

  const { data: memberships } = userIds.length
    ? await supabase
        .from("business_members")
        .select("user_id, role, businesses(name)")
        .in("user_id", userIds)
    : { data: [] };

  const { data: admins } = await supabase.from("platform_admins").select("user_id");
  const adminSet = new Set((admins ?? []).map((a) => a.user_id));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Registered accounts and their business memberships.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Businesses</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Signed up</th>
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const mems = (memberships ?? []).filter((m) => m.user_id === p.id);
              const bizNames = mems
                .map((m) => {
                  const b = m.businesses as
                    | { name: string }
                    | { name: string }[]
                    | null;
                  return Array.isArray(b) ? b[0]?.name : b?.name;
                })
                .filter(Boolean)
                .join(", ");
              const roles = [...new Set(mems.map((m) => m.role))].join(", ");
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {p.full_name || p.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {bizNames || "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{roles || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(new Date(p.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-3 py-2">
                    {adminSet.has(p.id) ? (
                      <span className="text-xs text-primary">Platform admin</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {!profiles?.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No users yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
