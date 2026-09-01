import { getCloudflareContext } from "@opennextjs/cloudflare";

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

/**
 * Resolve Supabase public credentials.
 *
 * Prefer SUPABASE_URL / SUPABASE_ANON_KEY on Cloudflare: those are read at
 * runtime and are NOT baked away when NEXT_PUBLIC_* are missing from the build.
 * NEXT_PUBLIC_* still work for local Next.js and for client bundles when set
 * as Cloudflare *build* variables.
 */
export async function getSupabasePublicEnv(): Promise<SupabasePublicEnv | null> {
  let url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  let anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  if (!url || !anonKey) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const cf = env as Record<string, string | undefined>;
      url =
        url ||
        cf.SUPABASE_URL?.trim() ||
        cf.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        "";
      anonKey =
        anonKey ||
        cf.SUPABASE_ANON_KEY?.trim() ||
        cf.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        "";
    } catch {
      // Not running inside a Cloudflare Worker request (e.g. local build).
    }
  }

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabasePublicEnvSync(): SupabasePublicEnv | null {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const MISSING_SUPABASE_ENV_MESSAGE =
  "Supabase is not configured. In Cloudflare set SUPABASE_URL and SUPABASE_ANON_KEY as Worker variables (runtime), and the same values as NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY under Build variables, then redeploy.";
