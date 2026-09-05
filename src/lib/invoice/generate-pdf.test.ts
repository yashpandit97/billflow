import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

import { generateInvoicePdf } from "@/lib/invoice/generate-pdf";
import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import {
  formatPaymentMethod,
  formatPaymentStatus,
} from "@/lib/invoice/pdf-text";

const sample: InvoiceData = {
  business: {
    name: "Yash Car Mods",
    logoUrl: null,
    address:
      "Flat #502, Sree Annapoorneshwari Nilaya, Pragati Nagar\nNear Hosa Road Metro Station, Electronic City, Bangalore",
    phone: "+918867642126",
    email: "yashpandit343@gmail.com",
    taxId: "29AAAAA0000A1Z5",
    currency: "INR",
    locale: "en-IN",
    primaryColor: "#D4AF37",
    invoiceStyle: "a4",
    invoiceFooter: "Thank you for your business!",
    paymentInstructions: null,
  },
  invoiceNumber: "INV-000013",
  invoiceDate: "05 Sep 2026",
  invoiceDateIso: "2026-09-05T00:00:00.000Z",
  customer: {
    id: "c1",
    name: "Nidhi",
    phone: "+917338353280",
    email: null,
    address: "#25 Hanumanavar Galli Angol",
    taxId: "33AAAAA0000A1Z5",
  },
  lines: [
    {
      id: "1",
      name: "abc",
      sku: null,
      quantity: 3,
      unitPrice: 100000,
      lineTotal: 300000,
      discount: 0,
    },
    {
      id: "2",
      name: "bcd with a moderately long product title for wrap",
      sku: null,
      quantity: 2,
      unitPrice: 106000,
      lineTotal: 212000,
      discount: 0,
    },
  ],
  subtotal: 512000,
  discount: 0,
  tax: 92160,
  total: 604160,
  paymentMethod: "upi",
  paymentStatus: "pending",
  notes: null,
  upi: { showQr: false, qrUrl: null, upiId: null },
  formatted: {
    subtotal: "₹5,120.00",
    discount: "₹0.00",
    tax: "₹921.60",
    total: "₹6,041.60",
  },
};

describe("invoice PDF payment labels", () => {
  it("capitalizes UPI and pending/paid", () => {
    expect(formatPaymentMethod("upi")).toBe("UPI");
    expect(formatPaymentMethod("cash")).toBe("Cash");
    expect(formatPaymentStatus("pending")).toBe("Pending");
    expect(formatPaymentStatus("paid")).toBe("Paid");
  });
});

describe("generateInvoicePdf", () => {
  it("builds a valid A4 PDF for multi-line address + UPI pending", async () => {
    const bytes = await generateInvoicePdf(sample);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const page = doc.getPage(0);
    expect(page.getWidth()).toBeCloseTo(595.28, 0);
    expect(page.getHeight()).toBeCloseTo(841.89, 0);
  });

  it("uses narrow thermal page width", async () => {
    const thermal = {
      ...sample,
      business: { ...sample.business, invoiceStyle: "thermal" as const },
    };
    const bytes = await generateInvoicePdf(thermal);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(226.77, 0);
  });

  it("renders a short cafe invoice (INV-000001 layout)", async () => {
    const cafe: InvoiceData = {
      ...sample,
      business: {
        ...sample.business,
        name: "Yash's cafe",
        address: null,
        phone: null,
        email: null,
        taxId: null,
        primaryColor: "#18181b",
      },
      invoiceNumber: "INV-000001",
      customer: {
        id: "c1",
        name: "Nidhi",
        phone: "+918867642126",
        email: null,
        address: "#25 Hanumanavar Galli Angol",
        taxId: null,
      },
      lines: [
        {
          id: "1",
          name: "tea",
          sku: null,
          quantity: 1,
          unitPrice: 2000,
          lineTotal: 2000,
          discount: 0,
        },
        {
          id: "2",
          name: "coffee",
          sku: null,
          quantity: 1,
          unitPrice: 2500,
          lineTotal: 2500,
          discount: 0,
        },
      ],
      subtotal: 4500,
      discount: 0,
      tax: 0,
      total: 4500,
      paymentMethod: "upi",
      paymentStatus: "paid",
      formatted: {
        subtotal: "₹45.00",
        discount: "₹0.00",
        tax: "₹0.00",
        total: "₹45.00",
      },
    };
    const bytes = await generateInvoicePdf(cafe);
    const doc = await PDFDocument.load(bytes);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(doc.getPageCount()).toBe(1);
  });
});
