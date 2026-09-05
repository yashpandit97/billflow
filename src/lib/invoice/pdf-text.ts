/** Pure text-wrapping helpers for invoice PDF layout (no PDF deps). */

export function formatPaymentMethod(method: string | null): string | null {
  if (!method) return null;
  return method
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w === "upi" ? "UPI" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function formatPaymentStatus(status: string | null): string | null {
  if (!status) return null;
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function wrapTextToLines(
  text: string,
  font: { widthOfTextAtSize: (t: string, size: number) => number },
  size: number,
  maxWidth: number
): string[] {
  const paragraphs = (text || "").replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          const trial = chunk + ch;
          if (font.widthOfTextAtSize(trial, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk = trial;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines.length ? lines : [""];
}

export function wrappedTextHeight(
  lineCount: number,
  size: number,
  lineHeightFactor = 1.3
): number {
  if (lineCount <= 0) return 0;
  return lineCount * size * lineHeightFactor;
}
