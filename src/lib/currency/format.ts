export interface CurrencyFormatOptions {
  code?: string;
  locale?: string;
}

/**
 * Format an integer amount in minor units (e.g. paise) for display.
 * Never pass floating-point currency values into this helper.
 */
export function formatCurrency(
  amountMinor: number,
  options: CurrencyFormatOptions = {}
): string {
  const code = options.code ?? "INR";
  const locale = options.locale ?? (code === "INR" ? "en-IN" : "en-US");

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** Convert a decimal major-unit string/number to integer minor units. */
export function toMinorUnits(major: number | string): number {
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convert integer minor units to a major-unit number for form inputs. */
export function toMajorUnits(minor: number): number {
  return minor / 100;
}

/** Parse a currency input string into minor units. */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return 0;
  return toMinorUnits(cleaned);
}
