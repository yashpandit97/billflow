import type { MemberRole } from "@/types/database";

/** Max bill discount as fraction of subtotal (0–1). Owner: no cap beyond subtotal. */
export function maxDiscountFraction(role: MemberRole): number | null {
  switch (role) {
    case "staff":
      return 0.1;
    case "admin":
      return 0.3;
    case "owner":
      return null;
    default:
      return 0;
  }
}

export function validateDiscountAmount(
  role: MemberRole,
  subtotalMinor: number,
  discountMinor: number
): { ok: true } | { ok: false; error: string } {
  const amount = Math.max(0, Math.trunc(discountMinor));
  const subtotal = Math.max(0, Math.trunc(subtotalMinor));

  if (amount > subtotal) {
    return { ok: false, error: "Discount cannot exceed subtotal" };
  }

  const maxFraction = maxDiscountFraction(role);
  if (maxFraction !== null && subtotal > 0) {
    const maxAllowed = Math.floor(subtotal * maxFraction);
    if (amount > maxAllowed) {
      return {
        ok: false,
        error: `Discount exceeds your limit (${Math.round(maxFraction * 100)}% of subtotal)`,
      };
    }
  }

  return { ok: true };
}
