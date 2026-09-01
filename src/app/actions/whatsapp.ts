"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/currency/format";
import { buildInvoiceData } from "@/lib/invoice/build-invoice-data";
import {
  generateInvoicePdf,
  invoicePdfFilename,
} from "@/lib/invoice/generate-pdf";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { sendInvoiceViaWhatsApp } from "@/lib/whatsapp/sendInvoice";
import {
  buildInvoiceWhatsAppText,
  buildWaMeDeepLink,
} from "@/lib/whatsapp/templates";
import type { WhatsAppTenantConfig } from "@/lib/whatsapp/types";
import type {
  Bill,
  BillItem,
  Business,
  Customer,
  PaymentSettings,
} from "@/types/database";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppActionResult = {
  error?: string;
  success?: string;
  deliveryId?: string;
  deeplinkUrl?: string;
  cloudApiReady?: boolean;
  status?: string;
};

type BillBundle =
  | { ok: false; error: string }
  | {
      ok: true;
      supabase: SupabaseClient;
      tenantId: string;
      business: Business;
      bill: Bill & { customers?: Customer | null; bill_items?: BillItem[] };
      paymentSettings: PaymentSettings | null;
      customer: Customer | null;
      items: BillItem[];
    };

async function loadTenantWhatsAppConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WhatsAppTenantConfig> {
  const { data } = await supabase
    .from("whatsapp_settings")
    .select(
      "whatsapp_enabled, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_message_template"
    )
    .eq("business_id", tenantId)
    .maybeSingle();

  return {
    enabled: Boolean(data?.whatsapp_enabled),
    businessAccountId: data?.whatsapp_business_account_id ?? null,
    phoneNumberId: data?.whatsapp_phone_number_id ?? null,
    accessToken: data?.whatsapp_access_token ?? null,
    messageTemplate: data?.whatsapp_message_template ?? "invoice_delivery",
  };
}

async function loadBillBundle(billId: string): Promise<BillBundle> {
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

  if (!bill) return { ok: false, error: "Invoice not found" };

  if (bill.status === "cancelled") {
    return { ok: false, error: "Cannot send a cancelled invoice" };
  }

  if (bill.status === "draft" || !bill.invoice_number) {
    return {
      ok: false,
      error: "Finalize the invoice before sending on WhatsApp",
    };
  }

  return {
    ok: true,
    supabase,
    tenantId,
    business: business as Business,
    bill: bill as Bill & { customers?: Customer | null; bill_items?: BillItem[] },
    paymentSettings: (paymentSettings as PaymentSettings | null) ?? null,
    customer: (bill.customers as Customer | null) ?? null,
    items: (bill.bill_items as BillItem[] | null) ?? [],
  };
}

export async function getWhatsAppSendContextAction(billId: string): Promise<{
  error?: string;
  cloudApiReady?: boolean;
  customerName?: string | null;
  phone?: string | null;
  phoneDisplay?: string | null;
  invoiceNumber?: string;
  amountFormatted?: string;
  deeplinkUrl?: string | null;
}> {
  const bundle = await loadBillBundle(billId);
  if (!bundle.ok) return { error: bundle.error };

  const { supabase, tenantId, business, bill, customer } = bundle;
  const config = await loadTenantWhatsAppConfig(supabase, tenantId);
  const amountFormatted = formatCurrency(bill.total, {
    code: business.currency,
    locale: business.locale,
  });

  let phoneDisplay: string | null = null;
  let deeplinkUrl: string | null = null;
  if (customer?.phone) {
    const normalized = normalizeWhatsAppPhone(customer.phone);
    if (normalized.ok) {
      phoneDisplay = normalized.display;
      deeplinkUrl = buildWaMeDeepLink(
        normalized.e164,
        buildInvoiceWhatsAppText({
          customerName: customer.name,
          businessName: business.name,
          invoiceNumber: bill.invoice_number!,
          amountFormatted,
        })
      );
    }
  }

  return {
    cloudApiReady:
      config.enabled &&
      Boolean(config.phoneNumberId) &&
      Boolean(config.accessToken),
    customerName: customer?.name ?? null,
    phone: customer?.phone ?? null,
    phoneDisplay,
    invoiceNumber: bill.invoice_number!,
    amountFormatted,
    deeplinkUrl,
  };
}

export async function sendInvoiceWhatsAppAction(
  billId: string
): Promise<WhatsAppActionResult> {
  const bundle = await loadBillBundle(billId);
  if (!bundle.ok) return { error: bundle.error };

  const {
    supabase,
    tenantId,
    business,
    bill,
    paymentSettings,
    customer,
    items,
  } = bundle;

  if (!customer?.phone) {
    return {
      error: "Customer WhatsApp number is required to send this invoice.",
    };
  }

  const normalized = normalizeWhatsAppPhone(customer.phone);
  if (!normalized.ok) return { error: normalized.error };

  const invoiceData = buildInvoiceData({
    business,
    bill,
    items: [...items].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    customer,
    paymentSettings,
  });

  let pdfBytes: Uint8Array | undefined;
  try {
    pdfBytes = await generateInvoicePdf(invoiceData);
  } catch (err) {
    console.error("invoice pdf generation failed", err);
  }

  const config = await loadTenantWhatsAppConfig(supabase, tenantId);
  const amountFormatted = invoiceData.formatted.total;

  const { data: delivery, error: insertError } = await supabase
    .from("whatsapp_invoice_deliveries")
    .insert({
      tenant_id: tenantId,
      bill_id: billId,
      customer_id: customer.id,
      phone_number: normalized.e164,
      provider: "cloud_api",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !delivery) {
    return { error: insertError?.message ?? "Could not start delivery" };
  }

  const result = await sendInvoiceViaWhatsApp({
    config,
    input: {
      toE164: normalized.e164,
      customerName: customer.name,
      businessName: business.name,
      invoiceNumber: bill.invoice_number!,
      amountFormatted,
      pdfBytes,
      pdfFilename: invoicePdfFilename(invoiceData),
      templateName: config.messageTemplate || undefined,
    },
  });

  if (!result.ok) {
    await supabase
      .from("whatsapp_invoice_deliveries")
      .update({
        status: "failed",
        provider: result.provider,
        failed_at: new Date().toISOString(),
        error_code: result.errorCode ?? null,
        error_message: result.errorMessage.slice(0, 500),
      })
      .eq("id", delivery.id)
      .eq("tenant_id", tenantId);

    revalidatePath(`/bills/${billId}`);
    return {
      error: result.userMessage,
      deliveryId: delivery.id,
      deeplinkUrl: result.deeplinkUrl,
      cloudApiReady: false,
      status: "failed",
    };
  }

  await supabase
    .from("whatsapp_invoice_deliveries")
    .update({
      status: result.status,
      provider: result.provider,
      provider_message_id: result.providerMessageId ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq("id", delivery.id)
    .eq("tenant_id", tenantId);

  revalidatePath(`/bills/${billId}`);
  revalidatePath("/admin/whatsapp");
  return {
    success:
      result.status === "sent"
        ? "Invoice sent via WhatsApp (awaiting delivery confirmation)"
        : "WhatsApp send recorded",
    deliveryId: delivery.id,
    deeplinkUrl: result.deeplinkUrl,
    cloudApiReady: true,
    status: result.status,
  };
}

export async function openWhatsAppDeeplinkAction(
  billId: string
): Promise<WhatsAppActionResult> {
  const bundle = await loadBillBundle(billId);
  if (!bundle.ok) return { error: bundle.error };

  const { supabase, tenantId, business, bill, customer } = bundle;

  if (!customer?.phone) {
    return {
      error: "Customer WhatsApp number is required to send this invoice.",
    };
  }

  const normalized = normalizeWhatsAppPhone(customer.phone);
  if (!normalized.ok) return { error: normalized.error };

  const amountFormatted = formatCurrency(bill.total, {
    code: business.currency,
    locale: business.locale,
  });
  const text = buildInvoiceWhatsAppText({
    customerName: customer.name,
    businessName: business.name,
    invoiceNumber: bill.invoice_number!,
    amountFormatted,
  });
  const deeplinkUrl = buildWaMeDeepLink(normalized.e164, text);

  const { data: delivery, error } = await supabase
    .from("whatsapp_invoice_deliveries")
    .insert({
      tenant_id: tenantId,
      bill_id: billId,
      customer_id: customer.id,
      phone_number: normalized.e164,
      provider: "wa_me_deeplink",
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !delivery) {
    return { error: error?.message ?? "Could not record delivery", deeplinkUrl };
  }

  revalidatePath(`/bills/${billId}`);
  return {
    success:
      "WhatsApp opened. Attach the invoice PDF manually if needed — this does not auto-send the PDF.",
    deliveryId: delivery.id,
    deeplinkUrl,
    status: "pending",
  };
}

export async function updateCustomerPhoneForBillAction(input: {
  billId: string;
  phone: string;
}): Promise<WhatsAppActionResult> {
  const { supabase, tenantId } = await getActiveMembership();
  const normalized = normalizeWhatsAppPhone(input.phone);
  if (!normalized.ok) return { error: normalized.error };

  const { data: bill } = await supabase
    .from("bills")
    .select("id, customer_id")
    .eq("id", input.billId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!bill) return { error: "Invoice not found" };
  if (!bill.customer_id) {
    return {
      error:
        "Select or add a customer on this invoice before adding a WhatsApp number.",
    };
  }

  const { error } = await supabase
    .from("customers")
    .update({ phone: normalized.e164 })
    .eq("id", bill.customer_id)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath(`/bills/${input.billId}`);
  revalidatePath("/customers");
  revalidatePath("/billing");
  return { success: "WhatsApp number saved" };
}

export async function downloadInvoicePdfAction(
  billId: string
): Promise<{ error?: string; base64?: string; filename?: string }> {
  const bundle = await loadBillBundle(billId);
  if (!bundle.ok) return { error: bundle.error };

  const { business, bill, paymentSettings, customer, items } = bundle;
  const invoiceData = buildInvoiceData({
    business,
    bill,
    items: [...items].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    customer,
    paymentSettings,
  });

  try {
    const bytes = await generateInvoicePdf(invoiceData);
    return {
      base64: Buffer.from(bytes).toString("base64"),
      filename: invoicePdfFilename(invoiceData),
    };
  } catch (err) {
    console.error(err);
    return { error: "Could not generate PDF" };
  }
}
