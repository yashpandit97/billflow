"use server";

import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/forms";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/schemas";
import { redirect } from "next/navigation";

export type ActionResult = {
  error?: string;
  success?: string;
};

function supabaseUnavailableMessage(error: { message: string }) {
  const msg = error.message.toLowerCase();
  if (
    msg.includes("fetch failed") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("failed to fetch")
  ) {
    return "Cannot reach Supabase. Start it with `npx supabase start`, then copy keys into `.env.local`.";
  }
  return error.message;
}

export async function signUpAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      return { error: supabaseUnavailableMessage(error) };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return { error: supabaseUnavailableMessage({ message }) };
  }

  redirect("/onboarding");
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { error: supabaseUnavailableMessage(error) };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return { error: supabaseUnavailableMessage({ message }) };
  }

  const next = formString(formData, "next") || "/dashboard";
  redirect(next);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithGoogleAction(next?: string): Promise<
  ActionResult & { url?: string }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error:
        "Supabase is not configured on the server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Cloudflare (build + runtime), then redeploy.",
    };
  }

  try {
    const supabase = await createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const redirectTo = new URL(`${siteUrl}/auth/callback`);
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      redirectTo.searchParams.set("next", next);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error: supabaseUnavailableMessage(error) };
    }
    if (!data.url) {
      return { error: "Could not start Google sign-in. Check the Google provider in Supabase." };
    }

    return { url: data.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    return { error: supabaseUnavailableMessage({ message }) };
  }
}

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formString(formData, "email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    });

    if (error) {
      return { error: supabaseUnavailableMessage(error) };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return { error: supabaseUnavailableMessage({ message }) };
  }

  return { success: "Check your email for a password reset link." };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return { error: supabaseUnavailableMessage(error) };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    return { error: supabaseUnavailableMessage({ message }) };
  }

  redirect("/dashboard");
}
