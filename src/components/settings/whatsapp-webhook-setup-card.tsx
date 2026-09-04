"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function WhatsAppWebhookSetupCard({
  callbackUrl,
  verifyTokenConfigured,
  appSecretConfigured,
}: {
  callbackUrl: string;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      toast.success("Callback URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the URL manually");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <div>
        <h4 className="font-medium">Meta webhook setup</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste this Callback URL and your verify token into Meta → Use cases →
          WhatsApp → Configure Webhooks for the BillMoney platform app. Then
          subscribe to the{" "}
          <span className="font-medium text-foreground">messages</span> field.
          All tenant invoices are sent from this one WhatsApp Business number.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Callback URL</p>
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
            {callbackUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={copyUrl}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          Verify token env:{" "}
          <span
            className={
              verifyTokenConfigured
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "font-medium text-amber-600 dark:text-amber-400"
            }
          >
            {verifyTokenConfigured ? "configured" : "not set"}
          </span>
          {!verifyTokenConfigured
            ? " — set WHATSAPP_WEBHOOK_VERIFY_TOKEN on the Worker, then redeploy."
            : " — use the same value in Meta’s Verify token field."}
        </li>
        <li>
          App secret (POST signature):{" "}
          <span
            className={
              appSecretConfigured
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "font-medium text-muted-foreground"
            }
          >
            {appSecretConfigured ? "configured" : "optional / not set"}
          </span>
        </li>
      </ul>

      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Verify and save in Meta with the URL above.</li>
        <li>Subscribe webhook field “messages”.</li>
        <li>
          Create and approve template{" "}
          <code className="rounded bg-background px-1">invoice_delivery</code>{" "}
          (document header + body vars for name, business, invoice, amount).
        </li>
        <li>
          Paste Phone number ID and access token below, enable sending, Save.
        </li>
      </ol>
    </div>
  );
}
