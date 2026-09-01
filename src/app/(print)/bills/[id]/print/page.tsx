import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintControls } from "@/components/invoice/print-controls";
import { getActiveMembership } from "@/lib/auth/session";
import { notFound } from "next/navigation";

export default async function BillPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, tenantId, business } = await getActiveMembership();

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

  const isThermal = business.invoice_style === "thermal";

  return (
    <>
      <style>{`
        @page {
          size: ${isThermal ? "80mm auto" : "A4"};
          margin: ${isThermal ? "4mm" : "12mm"};
        }
        .invoice-row, .invoice-qr { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="min-h-svh bg-muted/30 p-6 print:bg-white print:p-0">
        <PrintControls backHref={`/bills/${bill.id}`} />
        <InvoiceDocument
          business={business}
          bill={bill}
          items={items}
          customer={bill.customers}
          paymentSettings={paymentSettings}
          variant="print"
        />
      </div>
    </>
  );
}
