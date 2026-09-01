import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
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
    fontFamily: "Helvetica-Bold",
  },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: "#71717a", marginBottom: 2 },
  invoiceMeta: { textAlign: "right" },
  invoiceLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  invoiceNumber: { fontSize: 14, fontFamily: "Helvetica-Bold" },
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
    fontFamily: "Helvetica-Bold",
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
    fontFamily: "Helvetica-Bold",
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
  footer: { marginTop: 24, fontFamily: "Helvetica-Bold" },
});

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
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
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
            <Text style={{ fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>
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

/** Generate invoice PDF bytes from canonical InvoiceData. */
export async function generateInvoicePdf(
  data: InvoiceData
): Promise<Uint8Array> {
  const instance = pdf(<InvoicePdfDocument data={data} />);
  const blob = await instance.toBlob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

export function invoicePdfFilename(data: InvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe || "invoice"}.pdf`;
}
