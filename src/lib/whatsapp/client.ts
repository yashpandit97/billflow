import {
  buildInvoiceTemplateComponents,
  buildInvoiceWhatsAppText,
  buildWaMeDeepLink,
} from "@/lib/whatsapp/templates";
import type {
  SendInvoiceWhatsAppInput,
  SendInvoiceWhatsAppResult,
  WhatsAppClient,
  WhatsAppTenantConfig,
} from "@/lib/whatsapp/types";

const GRAPH_API = "https://graph.facebook.com/v21.0";

/**
 * Official WhatsApp Cloud API client.
 * Never import this into client components.
 */
export function createWhatsAppCloudClient(
  config: WhatsAppTenantConfig
): WhatsAppClient {
  return {
    isConfigured() {
      return Boolean(
        config.enabled &&
          config.phoneNumberId &&
          config.accessToken &&
          config.accessToken.length > 10
      );
    },

    async sendInvoice(
      input: SendInvoiceWhatsAppInput
    ): Promise<SendInvoiceWhatsAppResult> {
      const text = buildInvoiceWhatsAppText(input);
      const deeplinkUrl = buildWaMeDeepLink(input.toE164, text);

      if (!this.isConfigured()) {
        return {
          ok: false,
          provider: "wa_me_deeplink",
          errorCode: "not_configured",
          errorMessage: "WhatsApp Cloud API is not configured for this business",
          userMessage:
            "Official WhatsApp sending is not connected. Use Open WhatsApp instead.",
          deeplinkUrl,
        };
      }

      try {
        const to = input.toE164.replace(/\D/g, "");
        let mediaId: string | undefined;

        if (input.pdfBytes && input.pdfBytes.length) {
          const uploadUrl = `${GRAPH_API}/${config.phoneNumberId}/media`;
          const form = new FormData();
          form.append(
            "file",
            new Blob([new Uint8Array(input.pdfBytes)], {
              type: "application/pdf",
            }),
            input.pdfFilename || "invoice.pdf"
          );
          form.append("messaging_product", "whatsapp");
          form.append("type", "application/pdf");

          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
            },
            body: form,
          });

          if (!uploadRes.ok) {
            const body = await uploadRes.text();
            console.error("whatsapp media upload failed", body);
            return {
              ok: false,
              provider: "cloud_api",
              errorCode: "media_upload_failed",
              errorMessage: body.slice(0, 500),
              userMessage:
                "Unable to send the invoice on WhatsApp. Please try again.",
              deeplinkUrl,
            };
          }

          const uploadJson = (await uploadRes.json()) as { id?: string };
          mediaId = uploadJson.id;
        }

        const payload = mediaId
          ? {
              messaging_product: "whatsapp",
              to,
              type: "document",
              document: {
                id: mediaId,
                filename: input.pdfFilename || "invoice.pdf",
                caption: text,
              },
            }
          : {
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: input.templateName || config.messageTemplate || "invoice_delivery",
                language: { code: "en" },
                components: buildInvoiceTemplateComponents(input),
              },
            };

        const res = await fetch(`${GRAPH_API}/${config.phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.text();
          console.error("whatsapp send failed", body);
          let code = "api_error";
          if (res.status === 401 || res.status === 403) code = "auth_failure";
          if (res.status === 429) code = "rate_limited";
          return {
            ok: false,
            provider: "cloud_api",
            errorCode: code,
            errorMessage: body.slice(0, 500),
            userMessage:
              "Unable to send the invoice on WhatsApp. Please try again.",
            deeplinkUrl,
          };
        }

        const json = (await res.json()) as {
          messages?: Array<{ id?: string }>;
        };
        const messageId = json.messages?.[0]?.id;

        // API accepted ≠ delivered. Status stays "sent" until webhook upgrades it.
        return {
          ok: true,
          provider: "cloud_api",
          providerMessageId: messageId,
          status: "sent",
        };
      } catch (err) {
        console.error("whatsapp network error", err);
        return {
          ok: false,
          provider: "cloud_api",
          errorCode: "network_error",
          errorMessage: err instanceof Error ? err.message : "network_error",
          userMessage:
            "Unable to send the invoice on WhatsApp. Please try again.",
          deeplinkUrl: buildWaMeDeepLink(
            input.toE164,
            buildInvoiceWhatsAppText(input)
          ),
        };
      }
    },
  };
}
