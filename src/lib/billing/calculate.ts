/**
 * Deterministic integer billing math.
 * All amounts are minor units (e.g. paise). Tax rates are basis points (5% = 500).
 */

export interface BillLineInput {
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
  lineDiscount: number;
}

export interface BillCalculationInput {
  lines: BillLineInput[];
  billDiscount: number;
  taxEnabled: boolean;
}

export interface CalculatedLine {
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
  lineDiscount: number;
  lineNet: number;
  lineTax: number;
  lineTotal: number;
}

export interface BillCalculationResult {
  lines: CalculatedLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.floor(Math.abs(n) + 0.5);
}

export function calculateBill(
  input: BillCalculationInput
): BillCalculationResult {
  const lines: CalculatedLine[] = input.lines.map((line) => {
    const qty = Math.max(0, line.quantity);
    const unitPrice = Math.max(0, Math.trunc(line.unitPrice));
    const lineDiscount = Math.max(0, Math.trunc(line.lineDiscount));
    const gross = qty * unitPrice;
    const lineNet = Math.max(0, gross - lineDiscount);

    return {
      quantity: qty,
      unitPrice,
      taxRateBps: Math.max(0, Math.trunc(line.taxRateBps)),
      lineDiscount,
      lineNet,
      lineTax: 0,
      lineTotal: lineNet,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineNet, 0);
  const discount = Math.min(Math.max(0, Math.trunc(input.billDiscount)), subtotal);

  if (!input.taxEnabled || subtotal === 0) {
    return {
      lines: lines.map((l) => ({ ...l, lineTax: 0, lineTotal: l.lineNet })),
      subtotal,
      discount,
      tax: 0,
      total: subtotal - discount,
    };
  }

  // Prorate bill discount across lines by lineNet share, then tax remaining.
  let allocatedDiscount = 0;
  let tax = 0;

  lines.forEach((line, index) => {
    let share = 0;
    if (subtotal > 0 && discount > 0) {
      if (index === lines.length - 1) {
        share = discount - allocatedDiscount;
      } else {
        share = roundHalfUp((line.lineNet * discount) / subtotal);
        allocatedDiscount += share;
      }
    }

    const taxable = Math.max(0, line.lineNet - share);
    const lineTax = roundHalfUp((taxable * line.taxRateBps) / 10000);
    line.lineTax = lineTax;
    line.lineTotal = line.lineNet;
    tax += lineTax;
  });

  return {
    lines,
    subtotal,
    discount,
    tax,
    total: subtotal - discount + tax,
  };
}
