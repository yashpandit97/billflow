"use server";

import { sendEmail } from "@/lib/email/send";

/**
 * Dev/smoke-test helper — sends Resend's sample “Hello World” email.
 * Replace RESEND_API_KEY (re_xxxxxxxxx) with your real key before calling.
 */
export async function sendResendHelloWorldAction(to: string): Promise<{
  ok: boolean;
  error?: string;
  id?: string;
}> {
  const trimmed = to.trim();
  if (!trimmed.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const result = await sendEmail({
    to: trimmed,
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}
