import { formatCurrency } from "@/lib/currency/format";
import { buildInvoiceData } from "@/lib/invoice/build-invoice-data";
import type {
  Bill,
  BillItem,
  Business,
  Customer,
  PaymentSettings,
} from "@/types/database";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function InvoiceDocument({
  business,
  bill,
  items,
  customer,
  paymentSettings,
  variant = "screen",
}: {
  business: Business;
  bill: Bill;
  items: BillItem[];
  customer?: Customer | null;
  paymentSettings?: PaymentSettings | null;
  variant?: "screen" | "print";
}) {
  const invoice = buildInvoiceData({
    business,
    bill,
    items,
    customer,
    paymentSettings,
  });
  const isThermal = invoice.business.invoiceStyle === "thermal";
  const showUpiQr = invoice.upi.showQr;
  const upiSelectedNoQr =
    bill.payment_method === "upi" &&
    (!paymentSettings?.upi_enabled || !paymentSettings.upi_qr_code_url);

  return (
    <div
      className={cn(
        "invoice-document bg-white text-zinc-900",
        isThermal ? "mx-auto w-[80mm] text-[11px]" : "mx-auto w-full max-w-[800px]",
        variant === "screen" && "rounded-xl border shadow-sm"
      )}
      style={
        {
          ["--brand" as string]: invoice.business.primaryColor,
        } as React.CSSProperties
      }
    >
      <div className={cn("p-6 sm:p-10", isThermal && "p-3")}>
        <div
          className={cn(
            "flex gap-4",
            isThermal ? "flex-col items-center text-center" : "items-start justify-between"
          )}
        >
          <div className={cn("flex gap-3", isThermal && "flex-col items-center")}>
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo_url}
                alt={business.name}
                className={cn(
                  "object-contain",
                  isThermal ? "h-12 w-12" : "h-14 w-14 rounded-md"
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-md font-semibold text-white",
                  isThermal ? "h-10 w-10 text-sm" : "h-14 w-14 text-lg"
                )}
                style={{ backgroundColor: business.primary_color }}
              >
                {business.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1
                className={cn("font-semibold tracking-tight", isThermal ? "text-sm" : "text-xl")}
              >
                {business.name}
              </h1>
              {business.address ? (
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {business.address}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {[business.phone, business.email].filter(Boolean).join(" · ")}
              </p>
              {business.tax_id ? (
                <p className="text-muted-foreground">GSTIN: {business.tax_id}</p>
              ) : null}
            </div>
          </div>
          <div className={cn(isThermal ? "mt-2 text-center" : "text-right")}>
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ color: business.primary_color }}
            >
              Invoice
            </p>
            <p className={cn("font-semibold", isThermal ? "text-sm" : "text-lg")}>
              {bill.invoice_number ||
                (bill.tab_label ? `Open · ${bill.tab_label}` : "Draft")}
            </p>
            <p className="text-muted-foreground">
              {format(new Date(bill.created_at), "dd MMM yyyy")}
            </p>
          </div>
        </div>

        {customer ? (
          <div className={cn("mt-8", isThermal && "mt-4 text-center")}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Bill to
            </p>
            <p className="font-medium">{customer.name}</p>
            {customer.phone ? (
              <p className="text-muted-foreground">{customer.phone}</p>
            ) : null}
            {customer.address ? (
              <p className="whitespace-pre-line text-muted-foreground">{customer.address}</p>
            ) : null}
            {customer.tax_id ? (
              <p className="text-muted-foreground">GSTIN: {customer.tax_id}</p>
            ) : null}
          </div>
        ) : null}

        <table className={cn("mt-8 w-full text-left", isThermal && "mt-4 text-[10px]")}>
          <thead>
            <tr
              className="border-b-2"
              style={{ borderColor: business.primary_color }}
            >
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="invoice-row border-b border-zinc-100">
                <td className="py-2.5 pr-2">
                  <div className="font-medium">{item.product_name}</div>
                  {item.sku ? (
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                  ) : null}
                </td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatCurrency(item.unit_price, {
                    code: invoice.business.currency,
                    locale: invoice.business.locale,
                  })}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatCurrency(item.line_total, {
                    code: invoice.business.currency,
                    locale: invoice.business.locale,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          className={cn(
            "mt-6 ml-auto space-y-1",
            isThermal ? "w-full" : "w-full max-w-xs"
          )}
        >
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{invoice.formatted.subtotal}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>{invoice.formatted.discount}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{invoice.formatted.tax}</span>
          </div>
          <div
            className="flex justify-between border-t-2 pt-2 text-lg font-semibold"
            style={{ borderColor: invoice.business.primaryColor }}
          >
            <span>TOTAL</span>
            <span>{invoice.formatted.total}</span>
          </div>
        </div>

        <div className={cn("mt-8 space-y-1 text-sm", isThermal && "mt-4 text-center")}>
          {bill.payment_method ? (
            <p>
              Payment method:{" "}
              <span className="font-medium">
                {bill.payment_method === "upi"
                  ? "UPI"
                  : bill.payment_method.replace(/_/g, " ").replace(/\b\w/g, (c) =>
                      c.toUpperCase()
                    )}
              </span>
              {bill.payment_status ? (
                <span className="text-muted-foreground">
                  {" "}
                  · Payment{" "}
                  {bill.payment_status === "paid"
                    ? "Paid"
                    : bill.payment_status === "pending"
                      ? "Pending"
                      : bill.payment_status}
                </span>
              ) : null}
            </p>
          ) : null}

          {showUpiQr ? (
            <div
              className={cn(
                "invoice-qr mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed p-4",
                isThermal && "mt-3 p-2"
              )}
            >
              <p className="text-xs font-semibold tracking-[0.2em] uppercase">
                Scan to pay
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invoice.upi.qrUrl!}
                alt="UPI QR code"
                className={cn(
                  "object-contain",
                  isThermal ? "h-28 w-28" : "h-40 w-40"
                )}
              />
              {paymentSettings?.upi_id ? (
                <p className="font-medium">UPI ID: {paymentSettings.upi_id}</p>
              ) : null}
            </div>
          ) : null}

          {upiSelectedNoQr ? (
            <p className="mt-4 text-muted-foreground">
              UPI selected — configure a QR code in Settings → Payment.
            </p>
          ) : null}

          {bill.notes ? (
            <p className="text-muted-foreground">Notes: {bill.notes}</p>
          ) : null}
          {business.payment_instructions ? (
            <p className="whitespace-pre-line text-muted-foreground">
              {business.payment_instructions}
            </p>
          ) : null}
          <p className="pt-4 font-medium">
            {business.invoice_footer || "Thank you for your business!"}
          </p>
        </div>
      </div>
    </div>
  );
}
