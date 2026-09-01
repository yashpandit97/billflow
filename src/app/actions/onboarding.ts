"use server";

import { getActiveMembership, requireUser } from "@/lib/auth/session";
import { REFERRAL_COOKIE } from "@/lib/referral/constants";
import { toMinorUnits } from "@/lib/currency/format";
import { businessSetupSchema, productSchema } from "@/lib/validation/schemas";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type OnboardingResult = {
  error?: string;
  success?: boolean;
};

export async function createBusinessAction(
  _prev: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const parsed = businessSetupSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || "",
    email: formData.get("email") || "",
    address: formData.get("address") || "",
    website: formData.get("website") || "",
    taxId: formData.get("taxId") || "",
    currency: formData.get("currency") || "INR",
    invoicePrefix: formData.get("invoicePrefix") || "INV",
    invoiceStartingNumber: formData.get("invoiceStartingNumber") || 1,
    defaultTaxRatePercent: formData.get("defaultTaxRatePercent") || 0,
    taxEnabled: formData.get("taxEnabled") === "on" || formData.get("taxEnabled") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  const taxBps = Math.round(parsed.data.defaultTaxRatePercent * 100);
  const cookieStore = await cookies();
  const referralCode = cookieStore.get(REFERRAL_COOKIE)?.value ?? null;

  const { error } = await supabase.rpc("create_business_with_owner", {
    p_name: parsed.data.name,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_address: parsed.data.address || null,
    p_website: parsed.data.website || null,
    p_tax_id: parsed.data.taxId || null,
    p_currency: parsed.data.currency,
    p_invoice_prefix: parsed.data.invoicePrefix,
    p_invoice_starting_number: parsed.data.invoiceStartingNumber,
    p_default_tax_rate_bps: taxBps,
    p_tax_enabled: parsed.data.taxEnabled,
    p_referral_code: referralCode,
  });

  if (error) {
    return { error: error.message };
  }

  cookieStore.delete(REFERRAL_COOKIE);

  redirect("/onboarding?step=product");
}

export async function createFirstProductAction(
  _prev: OnboardingResult,
  formData: FormData
): Promise<OnboardingResult> {
  const skip = formData.get("skip") === "true";
  if (skip) {
    redirect("/billing");
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || "",
    description: formData.get("description") || "",
    category_id: "",
    selling_price: formData.get("selling_price"),
    cost_price: formData.get("cost_price") || "",
    unit: formData.get("unit") || "pcs",
    tax_rate_percent: formData.get("tax_rate_percent") || 0,
    is_active: true,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId, business } = await getActiveMembership();

  const { error } = await supabase.from("products").insert({
    tenant_id: tenantId,
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    description: parsed.data.description || null,
    selling_price: toMinorUnits(parsed.data.selling_price),
    cost_price:
      parsed.data.cost_price === "" || parsed.data.cost_price == null
        ? null
        : toMinorUnits(Number(parsed.data.cost_price)),
    unit: parsed.data.unit,
    tax_rate_bps:
      parsed.data.tax_rate_percent != null
        ? Math.round(parsed.data.tax_rate_percent * 100)
        : business.default_tax_rate_bps,
    is_active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/products");
  redirect("/billing");
}
