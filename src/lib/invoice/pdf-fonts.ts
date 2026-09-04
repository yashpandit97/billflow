import "server-only";

const CDN_REGULAR =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf";
const CDN_BOLD =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Bold.ttf";

export type InvoiceFontBytes = {
  regular: Uint8Array;
  bold: Uint8Array;
};

let fontsPromise: Promise<InvoiceFontBytes> | null = null;

async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: "force-cache",
  });
  if (!res.ok) {
    throw new Error(`Font fetch failed (${res.status}): ${url}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length) throw new Error(`Empty font: ${url}`);
  return buf;
}

async function localFontBytes(filename: string): Promise<Uint8Array | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "public/fonts", filename));
    if (!buf.length) return null;
    return new Uint8Array(buf);
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

/** Load Roboto TTF bytes for pdf-lib (Workers-safe; no Yoga / react-pdf). */
export async function loadInvoiceFontBytes(): Promise<InvoiceFontBytes> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      let regular = await localFontBytes("InvoiceSans-Regular.ttf");
      let bold = await localFontBytes("InvoiceSans-Bold.ttf");
      let lastError: unknown;

      if (!regular || !bold) {
        const regularCandidates = [
          siteFontUrl("InvoiceSans-Regular.ttf"),
          CDN_REGULAR,
        ].filter(Boolean) as string[];
        const boldCandidates = [
          siteFontUrl("InvoiceSans-Bold.ttf"),
          CDN_BOLD,
        ].filter(Boolean) as string[];

        if (!regular) {
          for (const url of regularCandidates) {
            try {
              regular = await fetchFontBytes(url);
              break;
            } catch (err) {
              lastError = err;
            }
          }
        }
        if (!bold) {
          for (const url of boldCandidates) {
            try {
              bold = await fetchFontBytes(url);
              break;
            } catch (err) {
              lastError = err;
            }
          }
        }
      }

      if (!regular || !bold) {
        fontsPromise = null;
        throw new Error(
          `Could not load invoice fonts: ${
            lastError instanceof Error ? lastError.message : "unknown"
          }`
        );
      }

      return { regular, bold };
    })().catch((err) => {
      fontsPromise = null;
      throw err;
    });
  }

  return fontsPromise;
}
