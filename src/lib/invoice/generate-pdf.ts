import "server-only";

import type { InvoiceData } from "@/lib/invoice/build-invoice-data";
import { formatCurrency } from "@/lib/currency/format";
import { loadInvoiceFontBytes } from "@/lib/invoice/pdf-fonts";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR = {
  text: rgb(0.094, 0.094, 0.106), // zinc-950
  muted: rgb(0.443, 0.443, 0.478), // zinc-500
  line: rgb(0.957, 0.957, 0.961), // zinc-100
  white: rgb(1, 1, 1),
};

function parseBrandColor(hex: string | null | undefined): RGB {
  const raw = (hex || "#18181b").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return COLOR.text;
  const n = parseInt(raw, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
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
    if (type.includes("png") || type.includes("webp")) {
      // pdf-lib does not embed webp; try png path for png only
      if (type.includes("webp")) return null;
      return await doc.embedPng(image.bytes);
    }
    if (type.includes("jpeg") || type.includes("jpg")) {
      return await doc.embedJpg(image.bytes);
    }
    // Guess by magic bytes
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

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  opts: {
    font: PDFFont;
    size?: number;
    color?: RGB;
    maxWidth?: number;
  }
): number {
  const size = opts.size ?? 10;
  const color = opts.color ?? COLOR.text;
  const value = text || "";
  if (opts.maxWidth) {
    page.drawText(value, {
      x,
      y,
      size,
      font: opts.font,
      color,
      maxWidth: opts.maxWidth,
    });
  } else {
    page.drawText(value, { x, y, size, font: opts.font, color });
  }
  return size;
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

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Header — brand left, invoice meta right
  const headerTop = y;
  if (logo) {
    const logoH = 48;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: MARGIN,
      y: headerTop - logoH,
      width: Math.min(logoW, 48),
      height: logoH,
    });
  } else {
    page.drawRectangle({
      x: MARGIN,
      y: headerTop - 48,
      width: 48,
      height: 48,
      color: brand,
    });
    const initial = data.business.name.slice(0, 1).toUpperCase() || "B";
    const iw = bold.widthOfTextAtSize(initial, 16);
    page.drawText(initial, {
      x: MARGIN + (48 - iw) / 2,
      y: headerTop - 32,
      size: 16,
      font: bold,
      color: COLOR.white,
    });
  }

  const textX = MARGIN + 60;
  let brandY = headerTop - 14;
  drawText(page, data.business.name, textX, brandY, {
    font: bold,
    size: 16,
  });
  brandY -= 14;
  if (data.business.address) {
    drawText(page, data.business.address, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: CONTENT_WIDTH * 0.45,
    });
    brandY -= 12;
  }
  const contact = [data.business.phone, data.business.email]
    .filter(Boolean)
    .join(" · ");
  if (contact) {
    drawText(page, contact, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
    });
    brandY -= 12;
  }
  if (data.business.taxId) {
    drawText(page, `GSTIN: ${data.business.taxId}`, textX, brandY, {
      font: regular,
      size: 9,
      color: COLOR.muted,
    });
    brandY -= 12;
  }

  // Invoice meta (right)
  rightText(page, "INVOICE", PAGE_WIDTH - MARGIN, headerTop - 12, {
    font: bold,
    size: 9,
    color: brand,
  });
  rightText(page, data.invoiceNumber, PAGE_WIDTH - MARGIN, headerTop - 28, {
    font: bold,
    size: 14,
  });
  rightText(page, data.invoiceDate, PAGE_WIDTH - MARGIN, headerTop - 44, {
    font: regular,
    size: 10,
    color: COLOR.muted,
  });

  y = Math.min(brandY, headerTop - 56) - 24;

  // Bill to
  if (data.customer.name) {
    drawText(page, "BILL TO", MARGIN, y, {
      font: regular,
      size: 8,
      color: COLOR.muted,
    });
    y -= 14;
    drawText(page, data.customer.name, MARGIN, y, { font: bold, size: 11 });
    y -= 13;
    if (data.customer.phone) {
      drawText(page, data.customer.phone, MARGIN, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
      });
      y -= 12;
    }
    if (data.customer.address) {
      drawText(page, data.customer.address, MARGIN, y, {
        font: regular,
        size: 9,
        color: COLOR.muted,
        maxWidth: CONTENT_WIDTH * 0.6,
      });
      y -= 12;
    }
    y -= 10;
  }

  // Table header
  const colItem = MARGIN;
  const colQty = MARGIN + CONTENT_WIDTH * 0.52;
  const colPrice = MARGIN + CONTENT_WIDTH * 0.68;
  const colTotal = PAGE_WIDTH - MARGIN;

  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 4 },
    thickness: 1.5,
    color: brand,
  });
  drawText(page, "Item", colItem, y, { font: bold, size: 9 });
  rightText(page, "Qty", colQty + 40, y, { font: bold, size: 9 });
  rightText(page, "Price", colPrice + 50, y, { font: bold, size: 9 });
  rightText(page, "Total", colTotal, y, { font: bold, size: 9 });
  y -= 18;

  for (const line of data.lines) {
    if (y < MARGIN + 160) {
      // Simple single-page invoice; truncate gracefully if overflow
      drawText(page, "…", MARGIN, y, { font: regular, size: 10 });
      break;
    }
    drawText(page, line.name, colItem, y, {
      font: regular,
      size: 10,
      maxWidth: CONTENT_WIDTH * 0.48,
    });
    rightText(page, String(line.quantity), colQty + 40, y, {
      font: regular,
      size: 10,
    });
    rightText(
      page,
      formatCurrency(line.unitPrice, currencyOpts),
      colPrice + 50,
      y,
      { font: regular, size: 10 }
    );
    rightText(
      page,
      formatCurrency(line.lineTotal, currencyOpts),
      colTotal,
      y,
      { font: regular, size: 10 }
    );
    if (line.sku) {
      y -= 11;
      drawText(page, line.sku, colItem, y, {
        font: regular,
        size: 8,
        color: COLOR.muted,
      });
    }
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: COLOR.line,
    });
    y -= 14;
  }

  // Totals
  y -= 8;
  const totalsX = PAGE_WIDTH - MARGIN - 200;
  const totalsRight = PAGE_WIDTH - MARGIN;
  const drawTotalRow = (
    label: string,
    value: string,
    strong = false
  ): void => {
    drawText(page, label, totalsX, y, {
      font: strong ? bold : regular,
      size: strong ? 12 : 10,
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

  if (data.paymentMethod) {
    y -= 4;
    const pay = `Payment method: ${data.paymentMethod.replace("_", " ")}${
      data.paymentStatus ? ` · Payment ${data.paymentStatus}` : ""
    }`;
    drawText(page, pay, MARGIN, y, { font: regular, size: 10 });
    y -= 18;
  }

  if (qr) {
    y -= 8;
    const boxH = 160;
    const boxY = y - boxH;
    page.drawRectangle({
      x: MARGIN + CONTENT_WIDTH / 2 - 90,
      y: boxY,
      width: 180,
      height: boxH,
      borderColor: rgb(0.831, 0.831, 0.847),
      borderWidth: 1,
      borderDashArray: [4, 3],
    });
    const scan = "SCAN TO PAY";
    const sw = bold.widthOfTextAtSize(scan, 10);
    page.drawText(scan, {
      x: MARGIN + CONTENT_WIDTH / 2 - sw / 2,
      y: boxY + boxH - 22,
      size: 10,
      font: bold,
      color: COLOR.text,
    });
    const qrSize = 110;
    page.drawImage(qr, {
      x: MARGIN + CONTENT_WIDTH / 2 - qrSize / 2,
      y: boxY + 28,
      width: qrSize,
      height: qrSize,
    });
    if (data.upi.upiId) {
      const upi = `UPI ID: ${data.upi.upiId}`;
      const uw = regular.widthOfTextAtSize(upi, 9);
      page.drawText(upi, {
        x: MARGIN + CONTENT_WIDTH / 2 - uw / 2,
        y: boxY + 12,
        size: 9,
        font: regular,
        color: COLOR.text,
      });
    }
    y = boxY - 16;
  }

  if (data.notes) {
    drawText(page, `Notes: ${data.notes}`, MARGIN, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: CONTENT_WIDTH,
    });
    y -= 14;
  }
  if (data.business.paymentInstructions) {
    drawText(page, data.business.paymentInstructions, MARGIN, y, {
      font: regular,
      size: 9,
      color: COLOR.muted,
      maxWidth: CONTENT_WIDTH,
    });
    y -= 14;
  }

  drawText(
    page,
    data.business.invoiceFooter || "Thank you for your business!",
    MARGIN,
    Math.max(y - 8, MARGIN),
    { font: bold, size: 10 }
  );

  return doc.save();
}

export function invoicePdfFilename(data: InvoiceData): string {
  const safe = data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${safe || "invoice"}.pdf`;
}
