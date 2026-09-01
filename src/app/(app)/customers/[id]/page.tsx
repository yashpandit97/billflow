import { Badge } from "@/components/ui/badge";
import { getActiveMembership } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/currency/format";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, tenantId, business } = await getActiveMembership();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!customer) notFound();

  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}
          </p>
          {customer.address ? (
            <p className="mt-2 text-sm text-muted-foreground">{customer.address}</p>
          ) : null}
          {customer.tax_id ? (
            <p className="mt-1 text-sm">Tax ID: {customer.tax_id}</p>
          ) : null}
        </div>
        <Link
          href="/customers"
          className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-muted"
        >
          Back
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Billing history
        </h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(bills ?? []).map((bill) => (
                <tr key={bill.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/bills/${bill.id}`} className="font-medium hover:underline">
                      {bill.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(bill.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(bill.total, {
                      code: business.currency,
                      locale: business.locale,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={bill.status === "paid" ? "default" : "secondary"}>
                      {bill.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!bills?.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No invoices yet for this customer.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
