import {
  appOriginFromRequest,
  applyOAuthCookies,
  createOAuthServerClient,
  safeNextPath,
} from "@/lib/auth/oauth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = appOriginFromRequest(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const fail = () => NextResponse.redirect(`${origin}/login?error=auth`);

  if (!code) {
    return fail();
  }

  const { supabase, cookiesToSet } = await createOAuthServerClient(request);
  if (!supabase) {
    return fail();
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail();
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  applyOAuthCookies(response, cookiesToSet, origin);
  return response;
}
