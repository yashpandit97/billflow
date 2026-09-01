import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublicEnvSync,
  MISSING_SUPABASE_ENV_MESSAGE,
} from "@/lib/supabase/env";

export function createClient() {
  const env = getSupabasePublicEnvSync();
  if (!env) {
    throw new Error(MISSING_SUPABASE_ENV_MESSAGE);
  }
  return createBrowserClient(env.url, env.anonKey);
}
