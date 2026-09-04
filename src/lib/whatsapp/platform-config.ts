import { createServiceClient } from "@/lib/supabase/admin";
import type { WhatsAppCloudConfig } from "@/lib/whatsapp/types";

/**
 * Load the platform WhatsApp Cloud API config used for all tenants.
 * Env vars override DB when both phone number ID and access token are set
 * (convenient for Cloudflare Worker secrets).
 */
export async function loadPlatformWhatsAppConfig(): Promise<WhatsAppCloudConfig> {
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
  const envWaba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || null;
  const envTemplate =
    process.env.WHATSAPP_MESSAGE_TEMPLATE?.trim() || "invoice_delivery";
  const envEnabled = process.env.WHATSAPP_ENABLED;
  const envForcedOff =
    envEnabled === "0" || envEnabled === "false" || envEnabled === "off";

  if (envPhone && envToken && envToken.length > 10 && !envForcedOff) {
    return {
      enabled: true,
      businessAccountId: envWaba,
      phoneNumberId: envPhone,
      accessToken: envToken,
      messageTemplate: envTemplate,
    };
  }

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("platform_whatsapp_settings")
      .select(
        "enabled, whatsapp_business_account_id, whatsapp_phone_number_id, whatsapp_access_token, default_template_name"
      )
      .eq("id", 1)
      .maybeSingle();

    return {
      enabled: Boolean(data?.enabled),
      businessAccountId: data?.whatsapp_business_account_id ?? null,
      phoneNumberId: data?.whatsapp_phone_number_id ?? null,
      accessToken: data?.whatsapp_access_token ?? null,
      messageTemplate: data?.default_template_name ?? "invoice_delivery",
    };
  } catch (err) {
    console.error("platform whatsapp config load failed", err);
    return {
      enabled: false,
      businessAccountId: null,
      phoneNumberId: null,
      accessToken: null,
      messageTemplate: "invoice_delivery",
    };
  }
}

export function isCloudApiReady(config: WhatsAppCloudConfig): boolean {
  return Boolean(
    config.enabled &&
      config.phoneNumberId &&
      config.accessToken &&
      config.accessToken.length > 10
  );
}
