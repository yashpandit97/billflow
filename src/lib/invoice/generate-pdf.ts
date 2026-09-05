import "server-only";

import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";
import { loadInvoiceFontBytes } from "@/lib/invoice/pdf-fonts";
import {
  formatPaymentMethod,
  formatPaymentStatus,
  wrapTextToLines,
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

function ascentOf(font: PDFFont, size: number): number {
  const h = font.heightAtSize(size, { descender: false });
  return Number.isFinite(h) && h > 0 ? h : size * 0.8;
}

function descentOf(font: PDFFont, size: number): number {
  const full = font.heightAtSize(size);
  const ascent = ascentOf(font, size);
  const d = (Number.isFinite(full) && full > 0 ? full : size) - ascent;
  return d > 0 ? d : size * 0.2;
}

function glyphHeight(font: PDFFont, size: number): number {
  return ascentOf(font, size) + descentOf(font, size);
}

type DrawOpts = {
  font: PDFFont;
  size?: number;
  color?: RGB;
  maxWidth?: number;
  lineHeightFactor?: number;
  align?: "left" | "right" | "center";
};

/**
 * `topY` is the top of the first line's glyph box (not the PDF baseline).
 * Returns the y just below the last line's descenders.
 */
function paintText(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  opts: DrawOpts
): number {
  const size = opts.size ?? 10;
  const color = opts.color ?? COLOR.text;
  const factor = opts.lineHeightFactor ?? 1.35;
  const ascent = ascentOf(opts.font, size);
  const descent = descentOf(opts.font, size);
  const lineStep = Math.max(size * factor, ascent + descent + 1);
  const maxWidth = opts.maxWidth;
  const lines = maxWidth
    ? wrapTextToLines(text, opts.font, size, maxWidth)
    : [(text || "").replace(/\r\n/g, "\n")];

  let top = topY;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const baseline = top - ascent;
    let drawX = x;
    if (opts.align === "right" && maxWidth) {
      drawX = x + maxWidth - opts.font.widthOfTextAtSize(line, size);
    } else if (opts.align === "center" && maxWidth) {
      drawX = x + (maxWidth - opts.font.widthOfTextAtSize(line, size)) / 2;
    }
    if (line) {
      page.drawText(line, {
        x: drawX,
        y: baseline,
        size,
        font: opts.font,
        color,
      });
    }
    if (i < lines.length - 1) {
      top -= lineStep;
    } else {
      top = baseline - descent;
    }
  }
  return top;
}

function paintRight(
  page: PDFPage,
  text: string,
  rightX: number,
  topY: number,
  opts: { font: PDFFont; size?: number; color?: RGB }
): number {
  const size = opts.size ?? 10;
  const ascent = ascentOf(opts.font, size);
  const baseline = topY - ascent;
  const width = opts.font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - width,
    y: baseline,
    size,
    font: opts.font,
    color: opts.color ?? COLOR.text,
  });
  return baseline - descentOf(opts.font, size);
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

  // Header — y is the top of remaining content (not a text baseline)
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
    const initialSize = isThermal ? 14 : 18;
    const iw = bold.widthOfTextAtSize(initial, initialSize);
    const ia = ascentOf(bold, initialSize);
    const id = descentOf(bold, initialSize);
    page.drawText(initial, {
      x: margin + (logoBox - iw) / 2,
      y: headerTop - logoBox + (logoBox - (ia + id)) / 2 + id,
      size: initialSize,
      font: bold,
      color: COLOR.white,
    });
  }

  const textX = isThermal ? margin : margin + logoBox + 12;
  const metaWidth = isThermal ? contentWidth : contentWidth * 0.38;
  const brandMaxWidth = isThermal
    ? contentWidth
    : contentWidth - logoBox - 12 - metaWidth - 8;

  let brandY = isThermal ? headerTop - logoDrawH - 10 : headerTop;

  brandY = paintText(page, data.business.name, textX, brandY, {
    font: bold,
    size: isThermal ? 12 : 16,
    maxWidth: brandMaxWidth,
  });
  brandY -= 4;

  if (data.business.address) {
    brandY = paintText(page, data.business.address, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: brandMaxWidth,
      lineHeightFactor: 1.25,
    });
    brandY -= 2;
  }
  const contact = [data.business.phone, data.business.email]
    .filter(Boolean)
    .join(" · ");
  if (contact) {
    brandY = paintText(page, contact, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: brandMaxWidth,
    });
    brandY -= 2;
  }
  if (data.business.taxId) {
    brandY = paintText(page, `GSTIN: ${data.business.taxId}`, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: brandMaxWidth,
    });
  }

  // Invoice meta (right on A4, below brand on thermal)
  if (isThermal) {
    y = brandY - 12;
    y = paintText(page, "INVOICE", margin, y, {
      font: bold,
      size: 8,
      color: brand,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 6;
    y = paintText(page, data.invoiceNumber, margin, y, {
      font: bold,
      size: 12,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 4;
    y = paintText(page, data.invoiceDate, margin, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: contentWidth,
      align: "center",
    });
    y -= 18;
  } else {
    let metaY = headerTop;
    metaY = paintRight(page, "INVOICE", pageWidth - margin, metaY, {
      font: bold,
      size: 9,
      color: brand,
    });
    metaY -= 6;
    metaY = paintRight(page, data.invoiceNumber, pageWidth - margin, metaY, {
      font: bold,
      size: 14,
    });
    metaY -= 4;
    metaY = paintRight(page, data.invoiceDate, pageWidth - margin, metaY, {
      font: regular,
      size: 10,
      color: COLOR.muted,
    });
    y = Math.min(brandY, metaY, headerTop - logoBox) - 28;
  }

  // Bill to
  if (data.customer.name) {
    ensureSpace(80);
    y = paintText(page, "BILL TO", margin, y, {
      font: regular,
      size: 8,
      color: COLOR.muted,
      maxWidth: contentWidth,
    });
    y -= 10;
    y = paintText(page, data.customer.name, margin, y, {
      font: bold,
      size: 11,
      maxWidth: contentWidth * 0.7,
    });
    y -= 3;
    if (data.customer.phone) {
      y = paintText(page, data.customer.phone, margin, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth,
      });
      y -= 2;
    }
    if (data.customer.address) {
      y = paintText(page, data.customer.address, margin, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth * 0.7,
        lineHeightFactor: 1.25,
      });
      y -= 2;
    }
    if (data.customer.taxId) {
      y = paintText(page, `GSTIN: ${data.customer.taxId}`, margin, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: contentWidth,
      });
    }
    y -= 22;
  }

  // Table — right edges for numeric columns so headers and values share alignment
  const qtyRight = margin + contentWidth * (isThermal ? 0.58 : 0.62);
  const priceRight = margin + contentWidth * (isThermal ? 0.78 : 0.81);
  const totalRight = pageWidth - margin;
  const itemMaxW = qtyRight - margin - 12;

  ensureSpace(40);
  const headerRowTop = y;
  paintText(page, "Item", margin, headerRowTop, {
    font: bold,
    size: 9,
  });
  paintRight(page, "Qty", qtyRight, headerRowTop, { font: bold, size: 9 });
  paintRight(page, "Price", priceRight, headerRowTop, { font: bold, size: 9 });
  const headerBottom = paintRight(page, "Total", totalRight, headerRowTop, {
    font: bold,
    size: 9,
  });
  y = headerBottom - 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: brand,
  });
  y -= 10;

  for (const line of data.lines) {
    const nameLines = wrapTextToLines(line.name, regular, 10, itemMaxW);
    const nameH =
      nameLines.length * Math.max(10 * 1.25, glyphHeight(regular, 10));
    const rowH = nameH + (line.sku ? glyphHeight(regular, 8) + 4 : 0) + 10;
    ensureSpace(rowH + 8);

    const rowTop = y;
    const nameBottom = paintText(page, line.name, margin, rowTop, {
      font: regular,
      size: 10,
      maxWidth: itemMaxW,
      lineHeightFactor: 1.25,
    });
    paintRight(page, String(line.quantity), qtyRight, rowTop, {
      font: regular,
      size: 10,
    });
    paintRight(
      page,
      formatCurrency(line.unitPrice, currencyOpts),
      priceRight,
      rowTop,
      { font: regular, size: 10 }
    );
    paintRight(
      page,
      formatCurrency(line.lineTotal, currencyOpts),
      totalRight,
      rowTop,
      { font: regular, size: 10 }
    );

    y = nameBottom;
    if (line.sku) {
      y -= 2;
      y = paintText(page, line.sku, margin, y, {
        font: regular,
        size: 8,
        color: COLOR.muted,
        maxWidth: itemMaxW,
      });
    }
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: COLOR.line,
    });
    y -= 10;
  }

  // Totals
  ensureSpace(90);
  y -= 8;
  const totalsWidth = isThermal ? contentWidth : 200;
  const totalsX = pageWidth - margin - totalsWidth;
  const totalsRightEdge = pageWidth - margin;

  const drawTotalRow = (
    label: string,
    value: string,
    strong = false
  ): void => {
    const size = strong ? 12 : 10;
    const font = strong ? bold : regular;
    const color = strong ? COLOR.text : COLOR.muted;
    paintText(page, label, totalsX, y, { font, size, color });
    y = paintRight(page, value, totalsRightEdge, y, { font, size, color });
    y -= strong ? 8 : 6;
  };

  drawTotalRow("Subtotal", data.formatted.subtotal);
  drawTotalRow("Discount", data.formatted.discount);
  drawTotalRow("Tax", data.formatted.tax);
  y -= 4;
  page.drawLine({
    start: { x: totalsX, y },
    end: { x: totalsRightEdge, y },
    thickness: 1.5,
    color: brand,
  });
  y -= 12;
  drawTotalRow("TOTAL", data.formatted.total, true);

  const methodLabel = formatPaymentMethod(data.paymentMethod);
  const statusLabel = formatPaymentStatus(data.paymentStatus);
  if (methodLabel) {
    ensureSpace(24);
    y -= 8;
    const pay = statusLabel
      ? `Payment method: ${methodLabel} · Payment ${statusLabel}`
      : `Payment method: ${methodLabel}`;
    y = paintText(page, pay, margin, y, {
      font: regular,
      size: 10,
      maxWidth: contentWidth,
    });
    y -= 6;
  }

  if (qr) {
    ensureSpace(L.qrSize + 70);
    y -= 8;
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
    paintText(page, "SCAN TO PAY", boxX, y - 8, {
      font: bold,
      size: 10,
      maxWidth: boxW,
      align: "center",
    });
    const qrSize = L.qrSize;
    page.drawImage(qr, {
      x: boxX + (boxW - qrSize) / 2,
      y: boxY + (data.upi.upiId ? 24 : 16),
      width: qrSize,
      height: qrSize,
    });
    if (data.upi.upiId) {
      paintText(page, `UPI ID: ${data.upi.upiId}`, boxX, boxY + 22, {
        font: regular,
        size: 9,
        maxWidth: boxW,
        align: "center",
      });
    }
    y = boxY - 14;
  }

  if (data.notes) {
    ensureSpace(40);
    y = paintText(page, `Notes: ${data.notes}`, margin, y, {
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
    y = paintText(page, data.business.paymentInstructions, margin, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: contentWidth,
      lineHeightFactor: 1.25,
    });
    y -= 4;
  }

  ensureSpace(24);
  paintText(
    page,
    data.business.invoiceFooter || "Thank you for your business!",
    margin,
    Math.max(y - 8, margin + glyphHeight(bold, 10)),
    { font: bold, size: 10, maxWidth: contentWidth }
  );

  return doc.save();
}

export function invoicePdfFilename(data: InvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe || "invoice"}.pdf`;
}
