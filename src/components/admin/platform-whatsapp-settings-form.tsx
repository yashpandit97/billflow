"use client";

import {
  updatePlatformWhatsAppSettingsAction,
  type WhatsAppSettingsResult,
} from "@/app/actions/whatsapp-settings";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformWhatsAppSettingsPublic } from "@/types/database";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

export function PlatformWhatsAppSettingsForm({
  settings,
}: {
  settings: PlatformWhatsAppSettingsPublic | null;
}) {
  const [state, action] = useActionState(
    updatePlatformWhatsAppSettingsAction,
    {} as WhatsAppSettingsResult
  );

  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="max-w-lg space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-medium">Platform WhatsApp sender</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All tenant invoice messages are sent from this BillMoney WhatsApp
          Business number — not from each business owner’s account.
        </p>
      </div>

      {settings?.env_override_active ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Worker env credentials (`WHATSAPP_PHONE_NUMBER_ID` +
          `WHATSAPP_ACCESS_TOKEN`) are active and override the values below for
          sending.
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings?.enabled}
          className="mt-0.5 size-4 rounded border"
        />
        <span>Enable official Cloud API sending</span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="display_phone_number">Display phone (optional)</Label>
        <Input
          id="display_phone_number"
          name="display_phone_number"
          defaultValue={settings?.display_phone_number ?? ""}
          placeholder="+91 …"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp_phone_number_id">Phone number ID</Label>
        <Input
          id="whatsapp_phone_number_id"
          name="whatsapp_phone_number_id"
          defaultValue={settings?.whatsapp_phone_number_id ?? ""}
          placeholder="Meta phone number ID"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp_business_account_id">
          WhatsApp Business Account ID
        </Label>
        <Input
          id="whatsapp_business_account_id"
          name="whatsapp_business_account_id"
          defaultValue={settings?.whatsapp_business_account_id ?? ""}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta_app_id">Meta App ID (optional)</Label>
        <Input
          id="meta_app_id"
          name="meta_app_id"
          defaultValue={settings?.meta_app_id ?? ""}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp_access_token">Access token</Label>
        <Input
          id="whatsapp_access_token"
          name="whatsapp_access_token"
          type="password"
          placeholder={
            settings?.has_access_token
              ? "••••••••  (leave blank to keep current)"
              : "Paste token (never shown again)"
          }
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_template_name">Template name</Label>
        <Input
          id="default_template_name"
          name="default_template_name"
          defaultValue={settings?.default_template_name ?? "invoice_delivery"}
        />
      </div>

      <SubmitButton>Save platform WhatsApp</SubmitButton>
    </form>
  );
}
