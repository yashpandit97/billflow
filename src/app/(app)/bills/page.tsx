import { BillsTable } from "@/components/bills/bills-table";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveMembership } from "@/lib/auth/session";
import { Receipt } from "lucide-react";
import { Suspense } from "react";

const PAGE_SIZE = 20;

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    status?: string;
    customer?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, tenantId, business } = await getActiveMembership();
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("bills")
    .select("*, customers(name)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) query = query.ilike("invoice_number", `%${params.q}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.customer) query = query.eq("customer_id", params.customer);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59`);

  const { data: bills, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, reprint, and manage invoice history.
        </p>
      </div>

      {!count && !params.q && !params.status && !params.from ? (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Create your first invoice from New Bill."
          actionLabel="New Bill"
          actionHref="/billing"
        />
      ) : (
        <Suspense>
          <BillsTable
            bills={bills ?? []}
            currency={business.currency}
            locale={business.locale}
            page={page}
            totalPages={totalPages}
          />
        </Suspense>
      )}
    </div>
  );
}
