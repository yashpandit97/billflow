import { createWhatsAppCloudClient } from "@/lib/whatsapp/client";
import {
  buildInvoiceWhatsAppText,
  buildWaMeDeepLink,
} from "@/lib/whatsapp/templates";
import type {
  SendInvoiceWhatsAppInput,
  SendInvoiceWhatsAppResult,
  WhatsAppTenantConfig,
} from "@/lib/whatsapp/types";

/**
 * High-level send entry used by billing actions.
 * Prefers Cloud API when configured; otherwise returns deeplink fallback metadata.
 */
export async function sendInvoiceViaWhatsApp(options: {
  config: WhatsAppTenantConfig;
  input: SendInvoiceWhatsAppInput;
  /** Force deeplink-only path (Open WhatsApp) */
  preferDeeplink?: boolean;
}): Promise<SendInvoiceWhatsAppResult> {
  const { config, input, preferDeeplink } = options;
  const text = buildInvoiceWhatsAppText(input);
  const deeplinkUrl = buildWaMeDeepLink(input.toE164, text);

  if (preferDeeplink) {
    return {
      ok: true,
      provider: "wa_me_deeplink",
      deeplinkUrl,
      status: "pending",
    };
  }

  const client = createWhatsAppCloudClient(config);
  if (!client.isConfigured()) {
    return {
      ok: false,
      provider: "wa_me_deeplink",
      errorCode: "not_configured",
      errorMessage: "Cloud API not configured",
      userMessage:
        "Official WhatsApp sending is not connected. Use Open WhatsApp instead.",
      deeplinkUrl,
    };
  }

  return client.sendInvoice(input);
}

export function getWhatsAppAvailability(config: WhatsAppTenantConfig): {
  cloudApiReady: boolean;
  canOpenDeeplink: boolean;
} {
  const client = createWhatsAppCloudClient(config);
  return {
    cloudApiReady: client.isConfigured(),
    canOpenDeeplink: true,
  };
}
