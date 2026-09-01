import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/** Normalize and validate a phone number; default region IN for local numbers. */
export function normalizeWhatsAppPhone(
  raw: string,
  defaultCountry: CountryCode = "IN"
): { ok: true; e164: string; display: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Phone number is required" };
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return {
      ok: false,
      error: "Enter a valid WhatsApp number (e.g. +91XXXXXXXXXX)",
    };
  }

  return {
    ok: true,
    e164: parsed.format("E.164"),
    display: parsed.formatInternational(),
  };
}

export function maskPhoneForDisplay(e164OrRaw: string): string {
  const digits = e164OrRaw.replace(/\D/g, "");
  if (digits.length < 6) return e164OrRaw;
  const last4 = digits.slice(-4);
  const prefix = digits.slice(0, Math.min(4, digits.length - 4));
  return `+${prefix} XXXXX ${last4}`;
}
