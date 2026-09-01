import { createClient } from "@/lib/supabase/server";

/** Redirect logged-in users into the app; null = show landing (guest or missing env). */
export async function getMarketingUserRedirect(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: admin } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return admin ? "/admin" : "/dashboard";
  } catch {
    return null;
  }
}
