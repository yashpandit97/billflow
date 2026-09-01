import { createBrowserClient } from "@supabase/ssr";

function requirePublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in Cloudflare build + runtime env, then redeploy."
    );
  }
  return { url, key };
}

export function createClient() {
  const { url, key } = requirePublicSupabaseEnv();
  return createBrowserClient(url, key);
}
