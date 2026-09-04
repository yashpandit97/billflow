import {
  buildInvoiceTemplateComponents,
  buildInvoiceWhatsAppText,
  buildWaMeDeepLink,
} from "@/lib/whatsapp/templates";
import type {
  SendInvoiceWhatsAppInput,
  SendInvoiceWhatsAppResult,
  WhatsAppClient,
  WhatsAppCloudConfig,
} from "@/lib/whatsapp/types";

const GRAPH_API = "https://graph.facebook.com/v21.0";


type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
  };
};

function mapGraphSendError(
  status: number,
  bodyText: string
): { errorCode: string; userMessage: string } {
  let parsed: GraphErrorBody | null = null;
  try {
    parsed = JSON.parse(bodyText) as GraphErrorBody;
  } catch {
    /* ignore */
  }

  const graphCode = parsed?.error?.code;
  const message = (parsed?.error?.message || bodyText).toLowerCase();

  if (status === 401 || status === 403 || graphCode === 190) {
    return {
      errorCode: "auth_failure",
      userMessage:
        "WhatsApp access token is invalid or expired. Update it in Settings → WhatsApp.",
    };
  }
  if (status === 429) {
    return {
      errorCode: "rate_limited",
      userMessage: "WhatsApp rate limit reached. Please try again shortly.",
    };
  }
  if (
    graphCode === 132000 ||
    graphCode === 132001 ||
    graphCode === 132005 ||
    graphCode === 132012 ||
    message.includes("template") ||
    message.includes("translation")
  ) {
    return {
      errorCode: "template_error",
      userMessage:
        "Invoice template is missing or not approved in Meta. Create and approve “invoice_delivery” (document header + body variables), then try again.",
    };
  }
  if (
    graphCode === 131030 ||
    message.includes("not in allowed list") ||
    message.includes("recipient phone number not in")
  ) {
    return {
      errorCode: "recipient_not_allowed",
      userMessage:
        "This number is not allowed yet. Add it as a test recipient in Meta (unpublished apps) or publish the app.",
    };
  }
  if (
    graphCode === 133010 ||
    message.includes("account not registered")
  ) {
    return {
      errorCode: "sender_not_registered",
      userMessage:
        "Your WhatsApp business number is not registered for Cloud API yet. In Meta, register the phone (POST /{phone-number-id}/register with a 6-digit PIN), then try again.",
    };
  }

  return {
    errorCode: "api_error",
    userMessage: "Unable to send the invoice on WhatsApp. Please try again.",
  };
}

/**
 * Official WhatsApp Cloud API client.
 * Never import this into client components.
 */
export function createWhatsAppCloudClient(
  config: WhatsAppCloudConfig
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
        let mediaUploadFailed = false;

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
            mediaUploadFailed = true;
          } else {
            const uploadJson = (await uploadRes.json()) as { id?: string };
            mediaId = uploadJson.id;
          }
        }

        const templateName =
          input.templateName || config.messageTemplate || "invoice_delivery";

        // Always use an approved template for business-initiated invoice sends.
        // Session document messages only work inside the 24h customer window.
        const payload = {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            components: buildInvoiceTemplateComponents(input, {
              mediaId,
              filename: input.pdfFilename,
            }),
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
          const mapped = mapGraphSendError(res.status, body);
          return {
            ok: false,
            provider: "cloud_api",
            errorCode: mapped.errorCode,
            errorMessage: body.slice(0, 500),
            userMessage: mapped.userMessage,
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
          warning: mediaUploadFailed
            ? "Invoice message sent, but the PDF could not be attached. Check Meta media upload permissions and try again."
            : undefined,
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
