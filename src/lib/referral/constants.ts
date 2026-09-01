export const REFERRAL_COOKIE = "billflow_ref";

export function normalizeReferralCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}
