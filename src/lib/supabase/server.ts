import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabasePublicEnv,
  MISSING_SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";

export async function createClient() {
  // Read cookies first so Next opts the route into dynamic rendering
  // before we validate env (otherwise SSG prerender fails in CI).
  const cookieStore = await cookies();

  const env = await getSupabasePublicEnv();
  if (!env) {
    throw new Error(MISSING_SUPABASE_ENV_MESSAGE);
  }

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}
