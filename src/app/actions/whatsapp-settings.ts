"use server";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  isCloudApiReady,
  loadPlatformWhatsAppConfig,
} from "@/lib/whatsapp/platform-config";
import { platformWhatsAppSettingsSchema } from "@/lib/validation/schemas";
import type { PlatformWhatsAppSettingsPublic } from "@/types/database";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";

export type WhatsAppSettingsResult = {
  error?: string;
  success?: string;
};

/** Tenant-facing: whether platform Cloud API can send (no secrets). */
export async function getWhatsAppSendAvailability(): Promise<{
  cloudApiReady: boolean;
}> {
  const config = await loadPlatformWhatsAppConfig();
  return { cloudApiReady: isCloudApiReady(config) };
}

export async function getPlatformWhatsAppSettingsPublic(): Promise<PlatformWhatsAppSettingsPublic | null> {
  await requirePlatformAdmin();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("platform_whatsapp_settings")
    .select(
      "id, enabled, meta_app_id, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_access_token, display_phone_number, default_template_name, updated_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;

  const envOverride = Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  );

  return {
    enabled: Boolean(data.enabled),
    meta_app_id: data.meta_app_id ?? null,
    whatsapp_business_account_id: data.whatsapp_business_account_id ?? null,
    whatsapp_phone_number_id: data.whatsapp_phone_number_id ?? null,
    display_phone_number: data.display_phone_number ?? null,
    default_template_name: data.default_template_name ?? "invoice_delivery",
    has_access_token: Boolean(data.whatsapp_access_token),
    env_override_active: envOverride,
    updated_at: data.updated_at,
  };
}

export async function updatePlatformWhatsAppSettingsAction(
  _prev: WhatsAppSettingsResult,
  formData: FormData
): Promise<WhatsAppSettingsResult> {
  await requirePlatformAdmin();

  const parsed = platformWhatsAppSettingsSchema.safeParse({
    enabled:
      formData.get("enabled") === "on" || formData.get("enabled") === "true",
    whatsapp_business_account_id:
      formData.get("whatsapp_business_account_id") || "",
    whatsapp_phone_number_id: formData.get("whatsapp_phone_number_id") || "",
    whatsapp_access_token: formData.get("whatsapp_access_token") || "",
    display_phone_number: formData.get("display_phone_number") || "",
    default_template_name:
      formData.get("default_template_name") || "invoice_delivery",
    meta_app_id: formData.get("meta_app_id") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {
    id: 1,
    enabled: parsed.data.enabled,
    whatsapp_business_account_id:
      parsed.data.whatsapp_business_account_id || null,
    whatsapp_phone_number_id: parsed.data.whatsapp_phone_number_id || null,
    display_phone_number: parsed.data.display_phone_number || null,
    default_template_name:
      parsed.data.default_template_name || "invoice_delivery",
    meta_app_id: parsed.data.meta_app_id || null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.whatsapp_access_token) {
    update.whatsapp_access_token = parsed.data.whatsapp_access_token;
  }

  const { error } = await supabase
    .from("platform_whatsapp_settings")
    .upsert(update, { onConflict: "id" });

  if (error) return { error: error.message };
  revalidatePath("/admin/whatsapp");
  revalidatePath("/settings");
  return { success: "Platform WhatsApp settings saved" };
}

/** @deprecated Tenant credentials are no longer used — platform sends all messages. */
export async function getWhatsAppSettingsPublic() {
  return null;
}
