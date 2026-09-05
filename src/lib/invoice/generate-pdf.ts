import "server-only";

import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";
import { loadInvoiceFontBytes } from "@/lib/invoice/pdf-fonts";
import {
  formatPaymentMethod,
  formatPaymentStatus,
  wrapTextToLines,
  wrappedTextHeight,
} from "@/lib/invoice/pdf-text";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const THERMAL_WIDTH = 226.77; // ~80mm
const THERMAL_HEIGHT = 841.89;

const COLOR = {
  text: rgb(0.094, 0.094, 0.106),
  muted: rgb(0.443, 0.443, 0.478),
  line: rgb(0.898, 0.898, 0.91),
  white: rgb(1, 1, 1),
};

function parseBrandColor(hex: string | null | undefined): RGB {
  const raw = (hex || "#18181b").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return COLOR.text;
  const n = parseInt(raw, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function fitInBox(
  imgW: number,
  imgH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return { width: imgW * scale, height: imgH * scale };
}

async function fetchImageBytes(
  url: string | null | undefined
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!url) return null;
  try {
    let bytes: Uint8Array;
    let contentType = "image/png";

    if (url.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(url);
      if (!match) return null;
      contentType = match[1];
      bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
    } else {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) return null;
      contentType = res.headers.get("content-type") || "image/png";
      bytes = new Uint8Array(await res.arrayBuffer());
    }

    if (!bytes.length) return null;
    return { bytes, contentType };
  } catch (err) {
    console.warn("invoice image fetch failed", url, err);
    return null;
  }
}

async function embedImage(
  doc: PDFDocument,
  image: { bytes: Uint8Array; contentType: string } | null
): Promise<PDFImage | null> {
  if (!image) return null;
  const type = image.contentType.toLowerCase();
  try {
    if (type.includes("webp")) {
      // pdf-lib cannot embed WebP — upload path should reject WebP
      return null;
    }
    if (type.includes("png")) {
      return await doc.embedPng(image.bytes);
    }
    if (type.includes("jpeg") || type.includes("jpg")) {
      return await doc.embedJpg(image.bytes);
    }
    if (image.bytes[0] === 0x89 && image.bytes[1] === 0x50) {
      return await doc.embedPng(image.bytes);
    }
    if (image.bytes[0] === 0xff && image.bytes[1] === 0xd8) {
      return await doc.embedJpg(image.bytes);
    }
  } catch (err) {
    console.warn("invoice image embed failed", err);
  }
  return null;
}

type DrawOpts = {
  font: PDFFont;
  size?: number;
  color?: RGB;
  maxWidth?: number;
  lineHeightFactor?: number;
  align?: "left" | "right" | "center";
};

/** Draw text with wrapping; returns height consumed (baseline of first line to past last line). */
function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  opts: DrawOpts
): number {
  const size = opts.size ?? 10;
  const color = opts.color ?? COLOR.text;
  const factor = opts.lineHeightFactor ?? 1.3;
  const lineHeight = size * factor;
  const maxWidth = opts.maxWidth;
  const lines = maxWidth
    ? wrapTextToLines(text, opts.font, size, maxWidth)
    : [(text || "").replace(/\r\n/g, "\n")];

  let cursorY = y;
  for (const line of lines) {
    let drawX = x;
    if (opts.align === "right" && maxWidth) {
      drawX = x + maxWidth - opts.font.widthOfTextAtSize(line, size);
    } else if (opts.align === "center" && maxWidth) {
      drawX = x + (maxWidth - opts.font.widthOfTextAtSize(line, size)) / 2;
    }
    if (line) {
      page.drawText(line, {
        x: drawX,
        y: cursorY,
        size,
        font: opts.font,
        color,
      });
    }
    cursorY -= lineHeight;
  }
  return lines.length * lineHeight;
}

function rightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  opts: { font: PDFFont; size?: number; color?: RGB }
): void {
  const size = opts.size ?? 10;
  const width = opts.font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - width,
    y,
    size,
    font: opts.font,
    color: opts.color ?? COLOR.text,
  });
}

type Layout = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  isThermal: boolean;
  logoBox: number;
  qrSize: number;
};

function layoutFor(data: InvoiceData): Layout {
  const isThermal = data.business.invoiceStyle === "thermal";
  const pageWidth = isThermal ? THERMAL_WIDTH : A4_WIDTH;
  const pageHeight = isThermal ? THERMAL_HEIGHT : A4_HEIGHT;
  const margin = isThermal ? 14 : 40;
  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
    isThermal,
    logoBox: isThermal ? 36 : 56,
    qrSize: isThermal ? 90 : 120,
  };
}

/** Generate invoice PDF bytes from canonical InvoiceData (pdf-lib, Workers-safe). */
export async function generateInvoicePdf(
  data: InvoiceData
): Promise<Uint8Array> {
  const fonts = await loadInvoiceFontBytes();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular);
  const bold = await doc.embedFont(fonts.bold);

  const [logoRaw, qrRaw] = await Promise.all([
    fetchImageBytes(data.business.logoUrl),
    data.upi.showQr ? fetchImageBytes(data.upi.qrUrl) : Promise.resolve(null),
  ]);
  const logo = await embedImage(doc, logoRaw);
  const qr =
    data.upi.showQr && qrRaw ? await embedImage(doc, qrRaw) : null;

  const brand = parseBrandColor(data.business.primaryColor);
  const currencyOpts = {
    code: data.business.currency,
    locale: data.business.locale,
  };
  const L = layoutFor(data);
  const { pageWidth, pageHeight, margin, contentWidth, isThermal, logoBox } = L;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Brand accent bar at top
  page.drawRectangle({
    x: 0,
    y: pageHeight - 4,
    width: pageWidth,
    height: 4,
    color: brand,
  });

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 24) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      page.drawRectangle({
        x: 0,
        y: pageHeight - 4,
        width: pageWidth,
        height: 4,
        color: brand,
      });
    }
  };

  // Header
  const headerTop = y;
  let logoDrawW = logoBox;
  let logoDrawH = logoBox;
  if (logo) {
    const fitted = fitInBox(logo.width, logo.height, logoBox, logoBox);
    logoDrawW = fitted.width;
    logoDrawH = fitted.height;
    page.drawImage(logo, {
      x: margin,
      y: headerTop - logoDrawH,
      width: logoDrawW,
      height: logoDrawH,
    });
  } else {
    page.drawRectangle({
      x: margin,
      y: headerTop - logoBox,
      width: logoBox,
      height: logoBox,
      color: brand,
    });
    const initial = data.business.name.slice(0, 1).toUpperCase() || "B";
    const iw = bold.widthOfTextAtSize(initial, isThermal ? 14 : 18);
    page.drawText(initial, {
      x: margin + (logoBox - iw) / 2,
      y: headerTop - logoBox / 2 - (isThermal ? 5 : 6),
      size: isThermal ? 14 : 18,
      font: bold,
      color: COLOR.white,
    });
  }

  const textX = isThermal ? margin : margin + logoBox + 12;
  const metaWidth = isThermal
    ? contentWidth
    : contentWidth * 0.38;
  const brandMaxWidth = isThermal
    ? contentWidth
    : contentWidth - logoBox - 12 - metaWidth - 8;

  let brandY = headerTop - (isThermal ? logoDrawH + 10 : 16);
  if (!isThermal) {
    brandY = headerTop - 14;
  }

  brandY -= drawWrappedText(page, data.business.name, textX, brandY, {
    font: bold,
    size: isThermal ? 12 : 16,
    maxWidth: brandMaxWidth,
  });
  brandY += 2; // slight tighten after name

  if (data.business.address) {
    brandY -= drawWrappedText(page, data.business.address, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: brandMaxWidth,
      lineHeightFactor: 1.25,
    });
  }
  const contact = [data.business.phone, data.business.email]
    .filter(Boolean)
    .join(" · ");
  if (contact) {
    brandY -= drawWrappedText(page, contact, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: brandMaxWidth,
    });
  }
  if (data.business.taxId) {
    brandY -= drawWrappedText(
      page,
      `GSTIN: ${data.business.taxId}`,
      textX,
      brandY,
      {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: brandMaxWidth,
      }
    );
  }

  // Invoice meta (right on A4, below brand on thermal)
  if (isThermal) {
    y = brandY - 8;
    drawWrappedText(page, "INVOICE", margin, y, {
      font: bold,
      size: 8,
      color: brand,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 12;
    drawWrappedText(page, data.invoiceNumber, margin, y, {
      font: bold,
      size: 12,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 14;
    drawWrappedText(page, data.invoiceDate, margin, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 18;
  } else {
    const metaX = pageWidth - margin - metaWidth;
    rightText(page, "INVOICE", pageWidth - margin, headerTop - 12, {
      font: bold,
      size: 9,
      color: brand,
    });
    rightText(page, data.invoiceNumber, pageWidth - margin, headerTop - 28, {
      font: bold,
      size: 14,
    });
    rightText(page, data.invoiceDate, pageWidth - margin, headerTop - 44, {
      font: regular,
      size: 10,
      color: COLOR.muted,
    });
    void metaX;
    y = Math.min(brandY, headerTop - logoBox) - 20;
  }

  // Bill to
  if (data.customer.name) {
    ensureSpace(80);
    y -= drawWrappedText(page, "BILL TO", margin, y, {
      font: regular,
      size: 8,
      color: COLOR.muted,
      maxWidth: contentWidth,
    });
    y += 2;
    y -= drawWrappedText(page, data.customer.name, margin, y, {
      font: bold,
      size: 11,
      maxWidth: contentWidth * 0.7,
    });
    if (data.customer.phone) {
      y -= drawWrappedText(page, data.customer.phone, margin, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth,
      });
    }
    if (data.customer.address) {
      y -= drawWrappedText(page, data.customer.address, margin, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth * 0.7,
        lineHeightFactor: 1.25,
      });
    }
    if (data.customer.taxId) {
      y -= drawWrappedText(
        page,
        `GSTIN: ${data.customer.taxId}`,
        margin,
        y,
        {
          font: regular,
          size: 9,
          color: COLOR.muted,
          maxWidth: contentWidth,
        }
      );
    }
    y -= 10;
  }

  // Table
  const colItem = margin;
  const colQty = margin + contentWidth * (isThermal ? 0.5 : 0.52);
  const colPrice = margin + contentWidth * (isThermal ? 0.68 : 0.68);
  const colTotal = pageWidth - margin;
  const itemMaxW = contentWidth * (isThermal ? 0.46 : 0.48);

  ensureSpace(40);
  page.drawLine({
    start: { x: margin, y: y + 6 },
    end: { x: pageWidth - margin, y: y + 6 },
    thickness: 1.5,
    color: brand,
  });
  drawWrappedText(page, "Item", colItem, y, { font: bold, size: 9 });
  rightText(page, "Qty", colQty + 28, y, { font: bold, size: 9 });
  rightText(page, "Price", colPrice + 40, y, { font: bold, size: 9 });
  rightText(page, "Total", colTotal, y, { font: bold, size: 9 });
  y -= 16;

  for (const line of data.lines) {
    const nameLines = wrapTextToLines(line.name, regular, 10, itemMaxW);
    const nameH = wrappedTextHeight(nameLines.length, 10, 1.25);
    const rowH = nameH + (line.sku ? 12 : 0) + 10;
    ensureSpace(rowH + 8);

    const rowTop = y;
    drawWrappedText(page, line.name, colItem, y, {
      font: regular,
      size: 10,
      maxWidth: itemMaxW,
      lineHeightFactor: 1.25,
    });
    rightText(page, String(line.quantity), colQty + 28, rowTop, {
      font: regular,
      size: 10,
    });
    rightText(
      page,
      formatCurrency(line.unitPrice, currencyOpts),
      colPrice + 40,
      rowTop,
      { font: regular, size: 10 }
    );
    rightText(
      page,
      formatCurrency(line.lineTotal, currencyOpts),
      colTotal,
      rowTop,
      { font: regular, size: 10 }
    );

    y = rowTop - nameH;
    if (line.sku) {
      y -= drawWrappedText(page, line.sku, colItem, y, {
        font: regular,
        size: 8,
        color: COLOR.muted,
        maxWidth: itemMaxW,
      });
    }
    y -= 4;
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: pageWidth - margin, y: y + 2 },
      thickness: 0.5,
      color: COLOR.line,
    });
    y -= 10;
  }

  // Totals
  ensureSpace(90);
  y -= 4;
  const totalsWidth = isThermal ? contentWidth : 200;
  const totalsX = pageWidth - margin - totalsWidth;
  const totalsRight = pageWidth - margin;

  const drawTotalRow = (
    label: string,
    value: string,
    strong = false
  ): void => {
    page.drawText(label, {
      x: totalsX,
      y,
      size: strong ? 12 : 10,
      font: strong ? bold : regular,
      color: strong ? COLOR.text : COLOR.muted,
    });
    rightText(page, value, totalsRight, y, {
      font: strong ? bold : regular,
      size: strong ? 12 : 10,
      color: strong ? COLOR.text : COLOR.muted,
    });
    y -= strong ? 18 : 14;
  };

  drawTotalRow("Subtotal", data.formatted.subtotal);
  drawTotalRow("Discount", data.formatted.discount);
  drawTotalRow("Tax", data.formatted.tax);
  page.drawLine({
    start: { x: totalsX, y: y + 6 },
    end: { x: totalsRight, y: y + 6 },
    thickness: 1.5,
    color: brand,
  });
  drawTotalRow("TOTAL", data.formatted.total, true);

  const methodLabel = formatPaymentMethod(data.paymentMethod);
  const statusLabel = formatPaymentStatus(data.paymentStatus);
  if (methodLabel) {
    ensureSpace(24);
    y -= 4;
    const pay = statusLabel
      ? `Payment method: ${methodLabel} · Payment ${statusLabel}`
      : `Payment method: ${methodLabel}`;
    y -= drawWrappedText(page, pay, margin, y, {
      font: regular,
      size: 10,
      maxWidth: contentWidth,
    });
    y -= 6;
  }

  if (qr) {
    ensureSpace(L.qrSize + 70);
    y -= 4;
    const boxH = L.qrSize + 50;
    const boxW = Math.min(contentWidth, L.qrSize + 60);
    const boxX = margin + (contentWidth - boxW) / 2;
    const boxY = y - boxH;
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      borderColor: rgb(0.831, 0.831, 0.847),
      borderWidth: 1,
      borderDashArray: [4, 3],
    });
    const scan = "SCAN TO PAY";
    const sw = bold.widthOfTextAtSize(scan, 10);
    page.drawText(scan, {
      x: boxX + (boxW - sw) / 2,
      y: boxY + boxH - 20,
      size: 10,
      font: bold,
      color: COLOR.text,
    });
    const qrSize = L.qrSize;
    page.drawImage(qr, {
      x: boxX + (boxW - qrSize) / 2,
      y: boxY + (data.upi.upiId ? 24 : 16),
      width: qrSize,
      height: qrSize,
    });
    if (data.upi.upiId) {
      const upi = `UPI ID: ${data.upi.upiId}`;
      const uw = regular.widthOfTextAtSize(upi, 9);
      page.drawText(upi, {
        x: boxX + (boxW - uw) / 2,
        y: boxY + 10,
        size: 9,
        font: regular,
        color: COLOR.text,
      });
    }
    y = boxY - 14;
  }

  if (data.notes) {
    ensureSpace(40);
    y -= drawWrappedText(page, `Notes: ${data.notes}`, margin, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: contentWidth,
      lineHeightFactor: 1.25,
    });
    y -= 4;
  }
  if (data.business.paymentInstructions) {
    ensureSpace(40);
    y -= drawWrappedText(
      page,
      data.business.paymentInstructions,
      margin,
      y,
      {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth,
        lineHeightFactor: 1.25,
      }
    );
    y -= 4;
  }

  ensureSpace(24);
  drawWrappedText(
    page,
    data.business.invoiceFooter || "Thank you for your business!",
    margin,
    Math.max(y - 4, margin),
    { font: bold, size: 10, maxWidth: contentWidth }
  );

  return doc.save();
}

export function invoicePdfFilename(data: InvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe || "invoice"}.pdf`;
}
