import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnvSync } from "@/lib/supabase/env";

/** Local scripts / seed only. Never import from client components. */
export function createServiceClient() {
  const publicEnv = getSupabasePublicEnvSync();
  const url = publicEnv?.url || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
