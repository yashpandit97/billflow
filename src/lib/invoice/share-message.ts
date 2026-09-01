import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";

export function buildInvoiceShareMessage(invoice: InvoiceData): string {
  const customerName = invoice.customer.name?.trim() || "Customer";
  const payment = invoice.paymentMethod
    ? invoice.paymentMethod.replace("_", " ")
    : "—";

  return `Hello ${customerName},

Thank you for your purchase from ${invoice.business.name}.

Invoice: #${invoice.invoiceNumber}
Amount: ${invoice.formatted.total}
Payment: ${payment}

Please find your invoice attached.

Thank you for your business!
${invoice.business.name}`;
}

export function buildReferralShareMessage(appName: string, link: string): string {
  return `I've been using ${appName} for billing my business.

It's simple and easy to use.

You can try it free for 30 days:
${link}`;
}

export function formatInvoiceShareText(opts: {
  customerName?: string | null;
  businessName: string;
  invoiceNumber: string;
  totalMinor: number;
  currency: string;
  locale: string;
  paymentMethod?: string | null;
}): string {
  const money = formatCurrency(opts.totalMinor, {
    code: opts.currency,
    locale: opts.locale,
  });
  const customer = opts.customerName?.trim() || "Customer";
  const payment = opts.paymentMethod
    ? opts.paymentMethod.replace(/_/g, " ").toUpperCase()
    : "—";

  return `Hello ${customer},

Thank you for your purchase from ${opts.businessName}.

Invoice: #${opts.invoiceNumber}
Amount: ${money}
Payment: ${payment}

Please find your invoice attached.

Thank you for your business!
${opts.businessName}`;
}

export const buildInvoiceShareText = formatInvoiceShareText;
