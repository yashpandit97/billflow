import "server-only";

import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";
import { ensureInvoiceFonts, invoiceFont } from "@/lib/invoice/pdf-fonts";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    ...invoiceFont.regular,
    color: "#18181b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brandRow: { flexDirection: "row", gap: 12, maxWidth: "60%" },
  logo: { width: 48, height: 48, objectFit: "contain" },
  logoFallback: {
    width: 48,
    height: 48,
    backgroundColor: "#18181b",
    color: "#fff",
    textAlign: "center",
    paddingTop: 14,
    fontSize: 16,
    ...invoiceFont.bold,
  },
  businessName: { fontSize: 16, ...invoiceFont.bold, marginBottom: 4 },
  muted: { color: "#71717a", marginBottom: 2 },
  invoiceMeta: { textAlign: "right" },
  invoiceLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    ...invoiceFont.bold,
    marginBottom: 4,
  },
  invoiceNumber: { fontSize: 14, ...invoiceFont.bold },
  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#71717a",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    paddingBottom: 6,
    marginBottom: 4,
    ...invoiceFont.bold,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    paddingVertical: 6,
  },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: 200 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    color: "#71717a",
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    paddingTop: 6,
    marginTop: 4,
    fontSize: 12,
    ...invoiceFont.bold,
  },
  qrBox: {
    marginTop: 20,
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d4d4d8",
  },
  qr: { width: 120, height: 120, marginTop: 8 },
  footer: { marginTop: 24, ...invoiceFont.bold },
});

async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      // Avoid caching stale logos during invoice generation
      cache: "no-store",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("invoice image fetch failed", url, err);
    return null;
  }
}

async function withEmbeddedImages(data: InvoiceData): Promise<InvoiceData> {
  const [logoUrl, qrUrl] = await Promise.all([
    toDataUri(data.business.logoUrl),
    data.upi.showQr ? toDataUri(data.upi.qrUrl) : Promise.resolve(null),
  ]);

  return {
    ...data,
    business: { ...data.business, logoUrl },
    upi: {
      ...data.upi,
      qrUrl,
      // Don't show QR box if we couldn't embed the image
      showQr: Boolean(data.upi.showQr && qrUrl),
    },
  };
}

function InvoicePdfDocument({ data }: { data: InvoiceData }) {
  const currencyOpts = {
    code: data.business.currency,
    locale: data.business.locale,
  };
  const brand = data.business.primaryColor || "#18181b";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {data.business.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image src={data.business.logoUrl} style={styles.logo} />
            ) : (
              <Text style={{ ...styles.logoFallback, backgroundColor: brand }}>
                {data.business.name.slice(0, 1).toUpperCase()}
              </Text>
            )}
            <View>
              <Text style={styles.businessName}>{data.business.name}</Text>
              {data.business.address ? (
                <Text style={styles.muted}>{data.business.address}</Text>
              ) : null}
              <Text style={styles.muted}>
                {[data.business.phone, data.business.email]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {data.business.taxId ? (
                <Text style={styles.muted}>GSTIN: {data.business.taxId}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={{ ...styles.invoiceLabel, color: brand }}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.muted}>{data.invoiceDate}</Text>
          </View>
        </View>

        {data.customer.name ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bill to</Text>
            <Text style={{ ...invoiceFont.bold }}>
              {data.customer.name}
            </Text>
            {data.customer.phone ? (
              <Text style={styles.muted}>{data.customer.phone}</Text>
            ) : null}
            {data.customer.address ? (
              <Text style={styles.muted}>{data.customer.address}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={{ ...styles.tableHeader, borderBottomColor: brand }}>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.lines.map((line) => (
            <View key={line.id} style={styles.row}>
              <View style={styles.colItem}>
                <Text>{line.name}</Text>
                {line.sku ? (
                  <Text style={{ ...styles.muted, fontSize: 8 }}>{line.sku}</Text>
                ) : null}
              </View>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(line.unitPrice, currencyOpts)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(line.lineTotal, currencyOpts)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{data.formatted.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Discount</Text>
            <Text>{data.formatted.discount}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax</Text>
            <Text>{data.formatted.tax}</Text>
          </View>
          <View style={{ ...styles.grandTotal, borderTopColor: brand }}>
            <Text>TOTAL</Text>
            <Text>{data.formatted.total}</Text>
          </View>
        </View>

        {data.paymentMethod ? (
          <View style={styles.section}>
            <Text>
              Payment method:{" "}
              {data.paymentMethod.replace("_", " ")}
              {data.paymentStatus ? ` · Payment ${data.paymentStatus}` : ""}
            </Text>
          </View>
        ) : null}

        {data.upi.showQr && data.upi.qrUrl ? (
          <View style={styles.qrBox}>
            <Text style={{ ...invoiceFont.bold, letterSpacing: 1 }}>
              SCAN TO PAY
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.upi.qrUrl} style={styles.qr} />
            {data.upi.upiId ? <Text>UPI ID: {data.upi.upiId}</Text> : null}
          </View>
        ) : null}

        {data.notes ? (
          <Text style={{ ...styles.muted, marginTop: 12 }}>
            Notes: {data.notes}
          </Text>
        ) : null}
        {data.business.paymentInstructions ? (
          <Text style={{ ...styles.muted, marginTop: 8 }}>
            {data.business.paymentInstructions}
          </Text>
        ) : null}
        <Text style={styles.footer}>
          {data.business.invoiceFooter || "Thank you for your business!"}
        </Text>
      </Page>
    </Document>
  );
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("Unexpected PDF output type");
}

async function renderPdfBytes(
  element: React.ReactElement<React.ComponentProps<typeof Document>>
): Promise<Uint8Array> {
  // Prefer Node renderToBuffer when the Node build is loaded (Cloudflare nodejs_compat).
  try {
    const buffer = await renderToBuffer(element);
    return toUint8Array(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Browser build throws this — fall through to pdf().toBlob()
    if (!message.includes("Node specific API") && !message.includes("Node-specific")) {
      console.warn("renderToBuffer failed, trying toBlob", message);
    }
  }

  const instance = pdf(element);
  // toBuffer returns a stream in react-pdf; prefer toBlob for portability
  const blob = await instance.toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Generate invoice PDF bytes from canonical InvoiceData. */
export async function generateInvoicePdf(
  data: InvoiceData
): Promise<Uint8Array> {
  await ensureInvoiceFonts();
  const embedded = await withEmbeddedImages(data);
  return renderPdfBytes(
    <InvoicePdfDocument data={embedded} /> as React.ReactElement<
      React.ComponentProps<typeof Document>
    >
  );
}

export function invoicePdfFilename(data: InvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe || "invoice"}.pdf`;
}
