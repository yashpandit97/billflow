import {
  OWNER_ADMIN_COOKIE,
  OWNER_ADMIN_COOKIE_MAX_AGE,
  OWNER_ADMIN_PASSWORD,
  OWNER_ADMIN_USERNAME,
} from "@/lib/admin/credentials";

const TOKEN_PREFIX = "v1";

function getSigningSecret(): string {
  return (
    process.env.OWNER_ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "billmoney-owner-admin-dev-secret"
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still walk both to avoid leaking length via early return timing on short strings
    let result = a.length ^ b.length;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
    }
    return result === 0 && a.length === b.length;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return bufferToBase64Url(sig);
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function verifyOwnerCredentials(
  username: string,
  password: string
): boolean {
  return (
    timingSafeEqual(username, OWNER_ADMIN_USERNAME) &&
    timingSafeEqual(password, OWNER_ADMIN_PASSWORD)
  );
}

export async function createOwnerAdminToken(): Promise<string> {
  const expiresAt = Date.now() + OWNER_ADMIN_COOKIE_MAX_AGE * 1000;
  const payload = `${TOKEN_PREFIX}.${expiresAt}`;
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function verifyOwnerAdminToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [prefix, expiresStr, sig] = parts;
  if (prefix !== TOKEN_PREFIX || !expiresStr || !sig) return false;
  const expiresAt = Number(expiresStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const payload = `${prefix}.${expiresStr}`;
  const expected = await hmacSign(payload);
  return timingSafeEqual(sig, expected);
}

export function ownerAdminCookieOptions(maxAge = OWNER_ADMIN_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { OWNER_ADMIN_COOKIE, OWNER_ADMIN_COOKIE_MAX_AGE };
