/**
 * Public WhatsApp webhook setup info (no secrets).
 * Used by Settings and platform admin UI.
 */
export function getWhatsAppWebhookPublicInfo(): {
  callbackUrl: string;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
} {
  const base = (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return {
    callbackUrl: `${base}/api/whatsapp/webhook`,
    verifyTokenConfigured: Boolean(
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.length
    ),
    appSecretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET?.length),
  };
}
