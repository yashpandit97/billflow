"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { buildInvoiceData } from "@/lib/invoice/build-invoice-data";
import {
  generateInvoicePdf,
  invoicePdfFilename,
} from "@/lib/invoice/generate-pdf";
import { buildInvoiceShareMessage } from "@/lib/invoice/share-message";
import type {
  Bill,
  BillItem,
  Business,
  Customer,
  PaymentSettings,
} from "@/types/database";
import { revalidatePath } from "next/cache";

export type SendInvoiceEmailResult = {
  error?: string;
  success?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#18181b">
${text
  .split("\n")
  .map((line) =>
    line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`
  )
  .join("\n")}
</div>`;
}

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

/** Email the finalized invoice PDF to the customer's email via Resend. */
export async function sendInvoiceEmailAction(
  billId: string
): Promise<SendInvoiceEmailResult> {
  const { supabase, tenantId, business } = await getActiveMembership();

  const [{ data: bill }, { data: paymentSettings }] = await Promise.all([
    supabase
      .from("bills")
      .select("*, customers(*), bill_items(*)")
      .eq("id", billId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("payment_settings")
      .select("*")
      .eq("business_id", tenantId)
      .maybeSingle(),
  ]);

  if (!bill) return { error: "Invoice not found" };
  if (bill.status === "cancelled") {
    return { error: "Cannot send a cancelled invoice" };
  }
  if (bill.status === "draft" || !bill.invoice_number) {
    return { error: "Finalize the invoice before sending by email" };
  }

  const customer = (bill.customers as Customer | null) ?? null;
  const to = customer?.email?.trim() ?? "";
  if (!to || !to.includes("@")) {
    return {
      error:
        "Customer email is required to send this invoice. Add an email on the customer, then try again.",
    };
  }

  const items = ((bill.bill_items as BillItem[] | null) ?? []).slice().sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const invoiceData = buildInvoiceData({
    business: business as Business,
    bill: bill as Bill,
    items,
    customer,
    paymentSettings: (paymentSettings as PaymentSettings | null) ?? null,
  });

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateInvoicePdf(invoiceData);
  } catch (err) {
    console.error("invoice pdf generation failed", err);
    const detail = err instanceof Error ? err.message : "unknown error";
    return { error: `Could not generate PDF (${detail.slice(0, 120)})` };
  }

  const filename = invoicePdfFilename(invoiceData);
  const text = buildInvoiceShareMessage(invoiceData);
  const fromName = business.name?.replace(/[<>]/g, "") || "BillMoney";
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const replyTo = business.email?.trim() || undefined;

  const result = await sendEmail({
    to,
    from: `${fromName} <${fromAddress}>`,
    replyTo,
    subject: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.business.name}`,
    text,
    html: textToHtml(text),
    attachments: [
      {
        filename,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/bills/${billId}`);
  return {
    success: `Invoice emailed to ${to}`,
  };
}
