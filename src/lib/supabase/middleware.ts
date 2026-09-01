import { REFERRAL_COOKIE, normalizeReferralCode } from "@/lib/referral/constants";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isAdminRoute = pathname.startsWith("/admin");
  const isMarketingRoute =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/terms";

  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/m/") ||
    isMarketingRoute;

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
          request,
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
    const { data: admin } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = admin ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  // Platform admin area: skip tenant onboarding requirement
  if (user && isAdminRoute) {
    const { data: admin } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  if (
    user &&
    !isOnboardingRoute &&
    !isAuthRoute &&
    !isAdminRoute &&
    !isMarketingRoute &&
    pathname !== "/auth/callback"
  ) {
    const { data: memberships } = await supabase
      .from("business_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (!memberships?.length) {
      // Platform-only admins without a business go to /admin
      const { data: admin } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (admin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }

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
