import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

/** Resend client. Requires RESEND_API_KEY (replace re_xxxxxxxxx with your real key). */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === "re_xxxxxxxxx") {
    throw new Error(
      "RESEND_API_KEY is missing. Set it in .env.local (replace re_xxxxxxxxx with your real Resend API key)."
    );
  }
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev"
  );
}
