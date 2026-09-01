import type { SendInvoiceWhatsAppInput } from "@/lib/whatsapp/types";

export function buildInvoiceWhatsAppText(input: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  amountFormatted: string;
}): string {
  const firstName = input.customerName.trim().split(/\s+/)[0] || "there";
  return [
    `Hello ${firstName},`,
    ``,
    `Thank you for your purchase from ${input.businessName}.`,
    ``,
    `Invoice: ${input.invoiceNumber}`,
    `Amount: ${input.amountFormatted}`,
    ``,
    `Please find your invoice attached.`,
    ``,
    `Thank you for your business.`,
    ``,
    input.businessName,
  ].join("\n");
}

/** Cloud API template payload shape (Phase 2). */
export function buildInvoiceTemplateComponents(input: SendInvoiceWhatsAppInput) {
  return [
    {
      type: "body",
      parameters: [
        { type: "text", text: input.customerName.split(/\s+/)[0] || "there" },
        { type: "text", text: input.businessName },
        { type: "text", text: input.invoiceNumber },
        { type: "text", text: input.amountFormatted },
      ],
    },
  ];
}

export function buildWaMeDeepLink(e164: string, text: string): string {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
