import { REFERRAL_COOKIE, normalizeReferralCode } from "@/lib/referral/constants";
import {
  OWNER_ADMIN_COOKIE,
  verifyOwnerAdminToken,
} from "@/lib/admin/session";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isMarketingRoute =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/terms";

  const isOAuthRoute = pathname.startsWith("/auth/");

  const isPublicRoute =
    isAuthRoute ||
    isAdminLoginRoute ||
    isOAuthRoute ||
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname.startsWith("/m/") ||
    isMarketingRoute;

  // Do not touch auth cookies during the Google OAuth start/callback.
  // On Cloudflare, middleware Set-Cookie can drop the session the callback sets.
  if (isOAuthRoute) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Owner admin cookie gate (independent of Supabase auth)
  if (isAdminRoute) {
    const ownerToken = request.cookies.get(OWNER_ADMIN_COOKIE)?.value;
    const isOwner = await verifyOwnerAdminToken(ownerToken);

    if (isAdminLoginRoute) {
      if (isOwner) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    if (!isOwner) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const supabaseEnv = await getSupabasePublicEnv();

  // Without Supabase env, allow public routes and send everything else to login.
  if (!supabaseEnv) {
    if (isPublicRoute) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const refCode = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));
  if (refCode && (pathname === "/signup" || pathname === "/")) {
    supabaseResponse.cookies.set(REFERRAL_COOKIE, refCode, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users hitting auth pages or the marketing home go into the app.
  if (user && (isAuthRoute || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !isOnboardingRoute &&
    !isAuthRoute &&
    !isAdminRoute &&
    !isMarketingRoute &&
    !pathname.startsWith("/auth/") &&
    !pathname.startsWith("/api/whatsapp/webhook") &&
    !pathname.startsWith("/m/")
  ) {
    const { data: memberships } = await supabase
      .from("business_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (!memberships?.length) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  if (user && isOnboardingRoute) {
    const step = request.nextUrl.searchParams.get("step");
    if (step !== "product") {
      const { data: memberships } = await supabase
        .from("business_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (memberships?.length) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
