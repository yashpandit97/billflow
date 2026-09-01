"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { whatsappSettingsSchema } from "@/lib/validation/schemas";
import type { WhatsAppSettingsPublic } from "@/types/database";
import { revalidatePath } from "next/cache";

export type WhatsAppSettingsResult = {
  error?: string;
  success?: string;
};

export async function getWhatsAppSettingsPublic(): Promise<WhatsAppSettingsPublic | null> {
  const { supabase, tenantId } = await getActiveMembership();
  const { data } = await supabase
    .from("whatsapp_settings")
    .select(
      "business_id, whatsapp_enabled, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_message_template, whatsapp_access_token, created_at, updated_at"
    )
    .eq("business_id", tenantId)
    .maybeSingle();

  if (!data) return null;

  return {
    business_id: data.business_id,
    whatsapp_enabled: data.whatsapp_enabled,
    whatsapp_business_account_id: data.whatsapp_business_account_id,
    whatsapp_phone_number_id: data.whatsapp_phone_number_id,
    whatsapp_message_template: data.whatsapp_message_template,
    has_access_token: Boolean(data.whatsapp_access_token),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateWhatsAppSettingsAction(
  _prev: WhatsAppSettingsResult,
  formData: FormData
): Promise<WhatsAppSettingsResult> {
  const parsed = whatsappSettingsSchema.safeParse({
    whatsapp_enabled:
      formData.get("whatsapp_enabled") === "on" ||
      formData.get("whatsapp_enabled") === "true",
    whatsapp_business_account_id:
      formData.get("whatsapp_business_account_id") || "",
    whatsapp_phone_number_id: formData.get("whatsapp_phone_number_id") || "",
    whatsapp_access_token: formData.get("whatsapp_access_token") || "",
    whatsapp_message_template:
      formData.get("whatsapp_message_template") || "invoice_delivery",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();

  const update: Record<string, unknown> = {
    whatsapp_enabled: parsed.data.whatsapp_enabled,
    whatsapp_business_account_id:
      parsed.data.whatsapp_business_account_id || null,
    whatsapp_phone_number_id: parsed.data.whatsapp_phone_number_id || null,
    whatsapp_message_template:
      parsed.data.whatsapp_message_template || "invoice_delivery",
  };

  // Only overwrite token when a new value is provided (never echo existing token)
  if (parsed.data.whatsapp_access_token) {
    update.whatsapp_access_token = parsed.data.whatsapp_access_token;
  }

  const { error } = await supabase
    .from("whatsapp_settings")
    .upsert({ business_id: tenantId, ...update }, { onConflict: "business_id" });

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: "WhatsApp settings saved" };
}
