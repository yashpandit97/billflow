"use client";

import { createFirstProductAction, type OnboardingResult } from "@/app/actions/onboarding";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: OnboardingResult = {};

export function FirstProductForm({ defaultTaxPercent }: { defaultTaxPercent: number }) {
  const [state, formAction] = useActionState(createFirstProductAction, initial);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" name="name" placeholder="Cappuccino" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="selling_price">Selling price</Label>
            <Input
              id="selling_price"
              name="selling_price"
              type="number"
              min={0}
              step="0.01"
              placeholder="150"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" defaultValue="pcs" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU (optional)</Label>
            <Input id="sku" name="sku" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_rate_percent">Tax %</Label>
            <Input
              id="tax_rate_percent"
              name="tax_rate_percent"
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaultTaxPercent}
            />
          </div>
        </div>
        {state.error ? (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{state.error}</p>
        ) : null}
        <SubmitButton className="w-full">Add product & start billing</SubmitButton>
      </form>
      <form action={formAction}>
        <input type="hidden" name="skip" value="true" />
        <Button type="submit" variant="ghost" className="w-full">
          Skip for now
        </Button>
      </form>
    </div>
  );
}
