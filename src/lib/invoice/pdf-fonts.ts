import "server-only";

import { Font } from "@react-pdf/renderer";

const FONT_FAMILY = "InvoiceSans";

const CDN_REGULAR =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf";
const CDN_BOLD =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Bold.ttf";

let registerPromise: Promise<void> | null = null;

async function fetchAsFontDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: "force-cache",
  });
  if (!res.ok) {
    throw new Error(`Font fetch failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error(`Empty font: ${url}`);
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

async function localFontDataUri(filename: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "public/fonts", filename));
    if (!buf.length) return null;
    return `data:font/ttf;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function siteFontUrl(filename: string): string | null {
  const base = (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
  if (!base) return null;
  return `${base}/fonts/${filename}`;
}

/**
 * Register TTF fonts for invoice body text.
 * pdfkit's Helvetica still loads via FontStore (patched for Workers);
 * InvoiceSans is the document face.
 */
export async function ensureInvoiceFonts(): Promise<void> {
  if (!registerPromise) {
    registerPromise = (async () => {
      let regularUri =
        (await localFontDataUri("InvoiceSans-Regular.ttf")) ?? null;
      let boldUri = (await localFontDataUri("InvoiceSans-Bold.ttf")) ?? null;
      let lastError: unknown;

      if (!regularUri || !boldUri) {
        const regularCandidates = [
          siteFontUrl("InvoiceSans-Regular.ttf"),
          CDN_REGULAR,
        ].filter(Boolean) as string[];
        const boldCandidates = [
          siteFontUrl("InvoiceSans-Bold.ttf"),
          CDN_BOLD,
        ].filter(Boolean) as string[];

        for (const url of regularCandidates) {
          try {
            regularUri = await fetchAsFontDataUri(url);
            break;
          } catch (err) {
            lastError = err;
          }
        }
        for (const url of boldCandidates) {
          try {
            boldUri = await fetchAsFontDataUri(url);
            break;
          } catch (err) {
            lastError = err;
          }
        }
      }

      if (!regularUri || !boldUri) {
        registerPromise = null;
        throw new Error(
          `Could not load invoice fonts: ${
            lastError instanceof Error ? lastError.message : "unknown"
          }`
        );
      }

      Font.register({
        family: FONT_FAMILY,
        fonts: [
          { src: regularUri, fontWeight: 400 },
          { src: boldUri, fontWeight: 700 },
        ],
      });
    })().catch((err) => {
      registerPromise = null;
      throw err;
    });
  }

  await registerPromise;
}

export const invoiceFont = {
  family: FONT_FAMILY,
  regular: { fontFamily: FONT_FAMILY, fontWeight: 400 as const },
  bold: { fontFamily: FONT_FAMILY, fontWeight: 700 as const },
};
