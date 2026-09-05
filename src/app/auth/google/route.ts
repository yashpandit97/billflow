import {
  appOriginFromRequest,
  applyOAuthCookies,
  createOAuthServerClient,
  isGoogleAuthProviderEnabled,
  safeNextPath,
  safeReturnPath,
} from "@/lib/auth/oauth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = appOriginFromRequest(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const fail = (error = "auth") =>
    NextResponse.redirect(`${origin}${returnTo}?error=${error}`);

  const googleEnabled = await isGoogleAuthProviderEnabled();
  if (googleEnabled === false) {
    return fail("google-disabled");
  }

  const { supabase, cookiesToSet } = await createOAuthServerClient(request);
  if (!supabase) {
    return fail();
  }

  const redirectTo = new URL(`${origin}/auth/callback`);
  redirectTo.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return fail();
  }

  const response = NextResponse.redirect(data.url);
  applyOAuthCookies(response, cookiesToSet, origin);
  return response;
}
