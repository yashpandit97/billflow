import { BillActions } from "@/components/bills/bill-actions";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/lib/auth/permissions";
import { getActiveMembership } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, tenantId, business, role } = await getActiveMembership();

  const [{ data: bill }, { data: paymentSettings }] = await Promise.all([
    supabase
      .from("bills")
      .select("*, customers(*), bill_items(*)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("payment_settings")
      .select("*")
      .eq("business_id", tenantId)
      .maybeSingle(),
  ]);

  if (!bill) notFound();

  const items = [...(bill.bill_items ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const { data: refunds } =
    bill.status === "paid"
      ? await supabase
          .from("bill_refunds")
          .select("refund_amount")
          .eq("bill_id", id)
          .eq("tenant_id", tenantId)
      : { data: [] as { refund_amount: number }[] };

  const refundedTotal = (refunds ?? []).reduce((s, r) => s + r.refund_amount, 0);
  const refundMaxMajor = Math.max(0, (bill.total - refundedTotal) / 100);

  const statusLabel =
    bill.status === "paid"
      ? "Completed"
      : bill.status === "cancelled"
        ? "Cancelled"
        : "Draft";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {bill.invoice_number ||
                (bill.tab_label ? `Open · ${bill.tab_label}` : "Open tab")}
            </h1>
            <Badge
              variant={
                bill.status === "paid"
                  ? "default"
                  : bill.status === "cancelled"
                    ? "destructive"
                    : "secondary"
              }
            >
              {statusLabel}
            </Badge>
            <Badge variant="outline">Payment {bill.payment_status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Invoice preview</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/bills"
            className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm hover:bg-muted"
          >
            Back to bills
          </Link>
          <BillActions
            billId={bill.id}
            status={bill.status}
            paymentStatus={bill.payment_status}
            tabLabel={bill.tab_label}
            canCancel={hasPermission(role, "bill:cancel")}
            canRefund={hasPermission(role, "bill:refund") && refundMaxMajor > 0}
            refundMaxMajor={refundMaxMajor}
            currency={business.currency}
            locale={business.locale}
            businessName={business.name}
            invoiceNumber={bill.invoice_number || bill.id.slice(0, 8)}
            totalMinor={bill.total}
            customerName={bill.customers?.name}
            customerEmail={bill.customers?.email}
            paymentMethod={bill.payment_method}
          />
        </div>
      </div>

      <InvoiceDocument
        business={business}
        bill={bill}
        items={items}
        customer={bill.customers}
        paymentSettings={paymentSettings}
      />
    </div>
  );
}
