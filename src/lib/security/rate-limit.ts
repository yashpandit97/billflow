const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory rate limit for server actions (per key per minute). */
export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): { ok: true } | { ok: false; error: string } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, error: "Too many requests. Please wait a moment." };
  }

  bucket.count += 1;
  return { ok: true };
}
