"use client";

import {
  updateBrandingAction,
  updateBusinessProfileAction,
  updateInvoiceSettingsAction,
  updateTaxSettingsAction,
  uploadLogoAction,
  type SettingsResult,
} from "@/app/actions/settings";
import {
  removeUpiQrAction,
  updatePaymentSettingsAction,
  uploadUpiQrAction,
  type PaymentActionResult,
} from "@/app/actions/payments";
import { logoutAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { ReferAndEarnPanel } from "@/components/settings/refer-and-earn-panel";
import { TablesSettings } from "@/components/settings/tables-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  Business,
  BusinessMember,
  DiningTable,
  PaymentSettings,
  Profile,
} from "@/types/database";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

const empty: SettingsResult = {};

function useToastResult(state: SettingsResult | PaymentActionResult) {
  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state]);
}

export function SettingsClient({
  business,
  members,
  profile,
  billCount,
  userEmail,
  paymentSettings,
  tables,
  cloudApiReady,
  subscriptionOverview,
  canManageBilling = false,
}: {
  business: Business;
  members: (BusinessMember & { profiles?: Profile | null })[];
  profile: Profile | null;
  billCount: number;
  userEmail: string;
  paymentSettings: PaymentSettings | null;
  tables: DiningTable[];
  cloudApiReady: boolean;
  subscriptionOverview?: {
    priceLabel: string;
    status: string;
    isTrial: boolean;
    trialEndsAt: string | null;
    nextBillingDate: string | null;
    freeMonthsAvailable: number;
    freeMonthsEarned: number;
    referralLink: string;
    referralCode: string | null;
    successfulReferrals: number;
    pendingReferrals: number;
  } | null;
  canManageBilling?: boolean;
}) {
  const [profileState, profileAction] = useActionState(
    updateBusinessProfileAction,
    empty
  );
  const [brandState, brandAction] = useActionState(updateBrandingAction, empty);
  const [invoiceState, invoiceAction] = useActionState(
    updateInvoiceSettingsAction,
    empty
  );
  const [taxState, taxAction] = useActionState(updateTaxSettingsAction, empty);
  const [logoState, logoAction] = useActionState(
    async (_prev: SettingsResult, formData: FormData) => uploadLogoAction(formData),
    empty
  );
  const [payState, payAction] = useActionState(
    updatePaymentSettingsAction,
    empty
  );
  const [qrState, qrAction] = useActionState(
    async (_prev: PaymentActionResult, formData: FormData) =>
      uploadUpiQrAction(formData),
    empty
  );
  const [qrPending, startQrTransition] = useTransition();

  useToastResult(profileState);
  useToastResult(brandState);
  useToastResult(invoiceState);
  useToastResult(taxState);
  useToastResult(logoState);
  useToastResult(payState);
  useToastResult(qrState);

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="profile">Business Profile</TabsTrigger>
        {canManageBilling ? (
          <TabsTrigger value="billing">Billing</TabsTrigger>
        ) : null}
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="payment">Payment</TabsTrigger>
        <TabsTrigger value="invoice">Invoice</TabsTrigger>
        <TabsTrigger value="tables">Tables</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="tax">Tax</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <form action={profileAction} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Business name</Label>
            <Input id="name" name="name" defaultValue={business.name} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={business.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={business.email ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={business.address ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                defaultValue={business.website ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">GSTIN / Tax ID</Label>
              <Input id="tax_id" name="tax_id" defaultValue={business.tax_id ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_footer">Invoice footer</Label>
            <Textarea
              id="invoice_footer"
              name="invoice_footer"
              rows={2}
              defaultValue={business.invoice_footer ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_instructions">Payment instructions</Label>
            <Textarea
              id="payment_instructions"
              name="payment_instructions"
              rows={2}
              defaultValue={business.payment_instructions ?? ""}
            />
          </div>
          <SubmitButton>Save profile</SubmitButton>
        </form>
      </TabsContent>

      {canManageBilling && subscriptionOverview ? (
        <TabsContent value="billing">
          <ReferAndEarnPanel
            referralLink={subscriptionOverview.referralLink}
            referralCode={subscriptionOverview.referralCode}
            successfulReferrals={subscriptionOverview.successfulReferrals}
            freeMonthsEarned={subscriptionOverview.freeMonthsEarned}
            pendingReferrals={subscriptionOverview.pendingReferrals}
            freeMonthsAvailable={subscriptionOverview.freeMonthsAvailable}
            priceLabel={subscriptionOverview.priceLabel}
            trialEndsAt={subscriptionOverview.trialEndsAt}
            nextBillingDate={subscriptionOverview.nextBillingDate}
            status={subscriptionOverview.status}
            isTrial={subscriptionOverview.isTrial}
          />
        </TabsContent>
      ) : null}

      <TabsContent value="branding" className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <form action={logoAction} className="flex flex-wrap items-end gap-4">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt="Logo"
              className="h-16 w-16 rounded-md border object-contain"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="logo">Upload logo</Label>
            <Input id="logo" name="logo" type="file" accept="image/*" required />
          </div>
          <SubmitButton>Upload</SubmitButton>
        </form>

        <form action={brandAction} className="max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary brand color</Label>
              <Input
                id="primary_color"
                name="primary_color"
                type="color"
                defaultValue={business.primary_color}
                className="h-10 w-24 p-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary color</Label>
              <Input
                id="secondary_color"
                name="secondary_color"
                type="color"
                defaultValue={business.secondary_color}
                className="h-10 w-24 p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_style">Invoice style</Label>
            <select
              id="invoice_style"
              name="invoice_style"
              defaultValue={business.invoice_style}
              className="flex h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="a4">A4</option>
              <option value="thermal">Thermal / narrow</option>
            </select>
          </div>
          <SubmitButton>Save branding</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="payment" className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <form action={payAction} className="max-w-xl space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="upi_enabled"
              defaultChecked={paymentSettings?.upi_enabled ?? false}
              className="size-4 rounded border"
            />
            Enable UPI payments
          </label>
          <div className="space-y-2">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input
              id="upi_id"
              name="upi_id"
              placeholder="business@upi"
              defaultValue={paymentSettings?.upi_id ?? ""}
            />
          </div>
          <input type="hidden" name="payment_qr_mode" value="uploaded" />
          <p className="text-xs text-muted-foreground">
            Upload the QR from your bank / GPay / PhonePe app. Dynamic UPI amount
            QR is reserved for later.
          </p>
          <SubmitButton>Save UPI settings</SubmitButton>
        </form>

        <div className="max-w-xl space-y-4 border-t border-border pt-6">
          <h3 className="text-sm font-medium">Owner-uploaded UPI QR</h3>
          {paymentSettings?.upi_qr_code_url ? (
            <div className="flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paymentSettings.upi_qr_code_url}
                alt="UPI QR preview"
                className="h-40 w-40 rounded-lg border border-border bg-white object-contain p-2"
              />
              <Button
                variant="outline"
                disabled={qrPending}
                onClick={() => {
                  startQrTransition(async () => {
                    const res = await removeUpiQrAction();
                    if (res.error) toast.error(res.error);
                    else toast.success(res.success);
                  });
                }}
              >
                Remove QR
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No QR uploaded yet.</p>
          )}
          <form action={qrAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="qr">Upload / replace QR image</Label>
              <Input id="qr" name="qr" type="file" accept="image/*" required />
            </div>
            <SubmitButton>Upload QR</SubmitButton>
          </form>
        </div>
      </TabsContent>

      <TabsContent value="invoice" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <form action={invoiceAction} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice_prefix">Invoice prefix</Label>
            <Input
              id="invoice_prefix"
              name="invoice_prefix"
              defaultValue={business.invoice_prefix}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice_starting_number">Starting number</Label>
            <Input
              id="invoice_starting_number"
              name="invoice_starting_number"
              type="number"
              min={1}
              defaultValue={business.invoice_starting_number}
              disabled={billCount > 0}
            />
            {billCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Starting number is locked after the first invoice.
              </p>
            ) : null}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="open_tabs_enabled"
              defaultChecked={business.open_tabs_enabled}
              className="mt-0.5 size-4 rounded border"
            />
            <span>
              <span className="font-medium">Restaurant / open tabs mode</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Track multiple open bills (tables / takeaway) on Billing, and
                enable per-table QR guest menus.
              </span>
            </span>
          </label>
          <SubmitButton>Save invoice settings</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="tables" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <TablesSettings
          slug={business.slug}
          initialTables={tables}
          openTabsEnabled={business.open_tabs_enabled}
        />
      </TabsContent>

      <TabsContent value="whatsapp" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="max-w-lg space-y-3">
          <div>
            <h3 className="font-medium">WhatsApp invoices</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Invoice messages are sent from BillMoney’s WhatsApp Business
              number (not your personal WhatsApp). Customers still see your
              business name in the message body.
            </p>
          </div>
          <p
            className={
              cloudApiReady
                ? "rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            }
          >
            {cloudApiReady
              ? "Official WhatsApp sending is available for your invoices."
              : "Official WhatsApp sending is not connected yet. You can still use Open WhatsApp to send manually."}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="tax" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <form action={taxAction} className="max-w-md space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="tax_enabled"
              defaultChecked={business.tax_enabled}
              className="size-4 rounded border"
            />
            Enable tax on invoices
          </label>
          <div className="space-y-2">
            <Label htmlFor="default_tax_rate_percent">Default tax %</Label>
            <Input
              id="default_tax_rate_percent"
              name="default_tax_rate_percent"
              type="number"
              min={0}
              step="0.01"
              defaultValue={business.default_tax_rate_bps / 100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency code</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={business.currency}
              maxLength={3}
              required
            />
          </div>
          <SubmitButton>Save tax settings</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="users" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Team invites come later. Roles (owner, admin, staff) are ready in the schema.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {m.profiles?.full_name || m.user_id}
                  </td>
                  <td className="px-3 py-2 capitalize">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="account" className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="max-w-md space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{profile?.full_name || userEmail}</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">₹999/month per business</p>
            <p className="text-sm text-muted-foreground">
              One plan, all features. Covers your whole team — no per-seat fees.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your first 30 days are free. One subscription covers your whole
              team — owners and staff. Manage billing and referrals in the Billing
              tab.
            </p>
          </div>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => void logoutAction()}
          >
            Log out
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
