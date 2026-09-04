import "server-only";

import { getResendClient, getResendFromAddress } from "@/lib/email/resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Send an email via Resend. Server-only. */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: input.from ?? getResendFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id ?? "" };
}
