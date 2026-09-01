import { formatCurrency } from "@/lib/currency/format";
import type {
  Bill,
  BillItem,
  Business,
  Customer,
  PaymentSettings,
} from "@/types/database";
import { format } from "date-fns";

/** Canonical invoice representation shared by preview, print, PDF, and WhatsApp. */
export type InvoiceData = {
  business: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxId: string | null;
    currency: string;
    locale: string;
    primaryColor: string;
    invoiceStyle: "a4" | "thermal";
    invoiceFooter: string | null;
    paymentInstructions: string | null;
  };
  invoiceNumber: string;
  invoiceDate: string;
  invoiceDateIso: string;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
  };
  lines: Array<{
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    discount: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  notes: string | null;
  upi: {
    showQr: boolean;
    qrUrl: string | null;
    upiId: string | null;
  };
  formatted: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
  };
};

export function buildInvoiceData(input: {
  business: Business;
  bill: Bill;
  items: BillItem[];
  customer?: Customer | null;
  paymentSettings?: PaymentSettings | null;
}): InvoiceData {
  const { business, bill, items, customer, paymentSettings } = input;
  const opts = { code: business.currency, locale: business.locale };
  const showUpiQr =
    bill.payment_method === "upi" &&
    !!paymentSettings?.upi_enabled &&
    !!paymentSettings.upi_qr_code_url;

  return {
    business: {
      name: business.name,
      logoUrl: business.logo_url,
      address: business.address,
      phone: business.phone,
      email: business.email,
      taxId: business.tax_id,
      currency: business.currency,
      locale: business.locale,
      primaryColor: business.primary_color,
      invoiceStyle: business.invoice_style,
      invoiceFooter: business.invoice_footer,
      paymentInstructions: business.payment_instructions,
    },
    invoiceNumber:
      bill.invoice_number ||
      (bill.tab_label ? `Open · ${bill.tab_label}` : "Draft"),
    invoiceDate: format(new Date(bill.created_at), "dd MMM yyyy"),
    invoiceDateIso: bill.created_at,
    customer: {
      id: customer?.id ?? bill.customer_id,
      name: customer?.name ?? null,
      phone: customer?.phone ?? null,
      email: customer?.email ?? null,
      address: customer?.address ?? null,
      taxId: customer?.tax_id ?? null,
    },
    lines: items.map((item) => ({
      id: item.id,
      name: item.product_name,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      discount: item.discount,
    })),
    subtotal: bill.subtotal,
    discount: bill.discount,
    tax: bill.tax,
    total: bill.total,
    paymentMethod: bill.payment_method,
    paymentStatus: bill.payment_status,
    notes: bill.notes,
    upi: {
      showQr: showUpiQr,
      qrUrl: showUpiQr ? paymentSettings!.upi_qr_code_url : null,
      upiId: paymentSettings?.upi_id ?? null,
    },
    formatted: {
      subtotal: formatCurrency(bill.subtotal, opts),
      discount: formatCurrency(bill.discount, opts),
      tax: formatCurrency(bill.tax, opts),
      total: formatCurrency(bill.total, opts),
    },
  };
}
