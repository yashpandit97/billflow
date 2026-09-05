import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export function appOriginFromRequest(request: NextRequest): string {
  const host = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host
  )
    .split(",")[0]
    .trim();
  const proto = (
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "") ??
    "https"
  )
    .split(",")[0]
    .trim();
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export function safeReturnPath(path: string | null): "/login" | "/signup" {
  return path === "/signup" ? "/signup" : "/login";
}

export function applyOAuthCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
  origin: string
) {
  const secure = origin.startsWith("https");
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      sameSite: options?.sameSite ?? "lax",
      secure: options?.secure ?? secure,
      path: options?.path ?? "/",
    });
  });
}

export async function createOAuthServerClient(request: NextRequest) {
  const env = await getSupabasePublicEnv();
  const cookiesToSet: CookieToSet[] = [];
  if (!env) {
    return { env: null, cookiesToSet, supabase: null };
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(incoming) {
        incoming.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  return { env, cookiesToSet, supabase };
}

export async function isGoogleAuthProviderEnabled(): Promise<boolean | null> {
  const env = await getSupabasePublicEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { external?: { google?: boolean } };
    return data.external?.google === true;
  } catch {
    return null;
  }
}
