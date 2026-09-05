import { describe, expect, it } from "vitest";
import { wrapTextToLines, wrappedTextHeight } from "@/lib/invoice/pdf-text";

const mono = {
  widthOfTextAtSize: (t: string, size: number) => t.length * size * 0.5,
};

describe("invoice PDF text wrapping", () => {
  it("wraps long lines to fit maxWidth", () => {
    const lines = wrapTextToLines(
      "Flat #502, Sree Annapoorneshwari Nilaya, Pragati Nagar Near Metro",
      mono,
      10,
      80
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(mono.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(80 + 0.01);
    }
  });

  it("honors explicit newlines", () => {
    const lines = wrapTextToLines("Line one\nLine two", mono, 10, 500);
    expect(lines).toEqual(["Line one", "Line two"]);
  });

  it("computes wrapped height from line count", () => {
    expect(wrappedTextHeight(3, 10, 1.3)).toBeCloseTo(39);
    expect(wrappedTextHeight(0, 10)).toBe(0);
  });
});
