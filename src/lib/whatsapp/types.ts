export type WhatsAppProvider = "cloud_api" | "wa_me_deeplink" | "manual";

export type WhatsAppDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed";

/** Platform Cloud API credentials (single sender for all businesses). */
export type WhatsAppCloudConfig = {
  enabled: boolean;
  businessAccountId: string | null;
  phoneNumberId: string | null;
  /** Never expose to the browser */
  accessToken: string | null;
  messageTemplate: string | null;
};

/** @deprecated Use WhatsAppCloudConfig — kept as alias during rename */
export type WhatsAppTenantConfig = WhatsAppCloudConfig;

export type WhatsAppPlatformConfig = {
  enabled: boolean;
  defaultTemplateName: string | null;
};

export type SendInvoiceWhatsAppInput = {
  toE164: string;
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  amountFormatted: string;
  pdfBytes?: Uint8Array;
  pdfFilename?: string;
  templateName?: string;
};

export type SendInvoiceWhatsAppResult =
  | {
      ok: true;
      provider: WhatsAppProvider;
      providerMessageId?: string;
      /** True when only a deeplink was produced (manual send) */
      deeplinkUrl?: string;
      status: WhatsAppDeliveryStatus;
      /** Soft warning when send succeeded without PDF attachment */
      warning?: string;
    }
  | {
      ok: false;
      provider: WhatsAppProvider;
      errorCode?: string;
      errorMessage: string;
      /** Safe message for UI */
      userMessage: string;
      deeplinkUrl?: string;
    };

export type WhatsAppClient = {
  isConfigured(): boolean;
  sendInvoice(
    input: SendInvoiceWhatsAppInput
  ): Promise<SendInvoiceWhatsAppResult>;
};
