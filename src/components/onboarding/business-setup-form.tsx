"use client";

import { createBusinessAction, type OnboardingResult } from "@/app/actions/onboarding";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState } from "react";

const initial: OnboardingResult = {};

export function BusinessSetupForm() {
  const [state, formAction] = useActionState(createBusinessAction, initial);
  const [showMore, setShowMore] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" placeholder="e.g. Urban Cafe" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" placeholder="+91 98765 43210" />
      </div>

      <input type="hidden" name="currency" value="INR" />
      {!showMore ? (
        <>
          <input type="hidden" name="invoicePrefix" value="INV" />
          <input type="hidden" name="invoiceStartingNumber" value="1" />
          <input type="hidden" name="defaultTaxRatePercent" value="0" />
        </>
      ) : null}

      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? "Hide extra details" : "Add GST, address & invoice details"}
      </button>

      {showMore ? (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="space-y-2">
            <Label htmlFor="email">Business email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">GSTIN / Tax ID</Label>
            <Input id="taxId" name="taxId" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">Invoice prefix</Label>
              <Input id="invoicePrefix" name="invoicePrefix" defaultValue="INV" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceStartingNumber">Starting number</Label>
              <Input
                id="invoiceStartingNumber"
                name="invoiceStartingNumber"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultTaxRatePercent">Default GST %</Label>
            <Input
              id="defaultTaxRatePercent"
              name="defaultTaxRatePercent"
              type="number"
              min={0}
              step="0.01"
              defaultValue={18}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="taxEnabled"
              defaultChecked
              className="size-4 rounded border"
            />
            Add GST on invoices
          </label>
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  );
}
