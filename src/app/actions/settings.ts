"use server";

import { getActiveMembership } from "@/lib/auth/session";
import {
  brandingSchema,
  businessProfileSchema,
  invoiceSettingsSchema,
  taxSettingsSchema,
} from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";

export type SettingsResult = { error?: string; success?: string };

export async function updateBusinessProfileAction(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const parsed = businessProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    address: formData.get("address") || null,
    website: formData.get("website") || null,
    tax_id: formData.get("tax_id") || null,
    invoice_footer: formData.get("invoice_footer") || null,
    payment_instructions: formData.get("payment_instructions") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("businesses")
    .update({
      ...parsed.data,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/bills");
  return { success: "Business profile updated" };
}

export async function updateBrandingAction(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const parsed = brandingSchema.safeParse({
    primary_color: formData.get("primary_color"),
    secondary_color: formData.get("secondary_color"),
    invoice_style: formData.get("invoice_style"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("businesses")
    .update(parsed.data)
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: "Branding updated" };
}

export async function updateInvoiceSettingsAction(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const parsed = invoiceSettingsSchema.safeParse({
    invoice_prefix: formData.get("invoice_prefix"),
    invoice_starting_number: formData.get("invoice_starting_number"),
    open_tabs_enabled:
      formData.get("open_tabs_enabled") === "on" ||
      formData.get("open_tabs_enabled") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();

  const { count } = await supabase
    .from("bills")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("businesses")
      .update({
        invoice_prefix: parsed.data.invoice_prefix,
        open_tabs_enabled: parsed.data.open_tabs_enabled,
      })
      .eq("id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    revalidatePath("/billing");
    return {
      success:
        "Invoice settings updated. Starting number is locked after the first invoice.",
    };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      invoice_prefix: parsed.data.invoice_prefix,
      invoice_starting_number: parsed.data.invoice_starting_number,
      open_tabs_enabled: parsed.data.open_tabs_enabled,
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  await supabase
    .from("invoice_sequences")
    .update({ current_value: parsed.data.invoice_starting_number - 1 })
    .eq("tenant_id", tenantId);

  revalidatePath("/settings");
  revalidatePath("/billing");
  return { success: "Invoice settings updated" };
}

export async function updateTaxSettingsAction(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const parsed = taxSettingsSchema.safeParse({
    tax_enabled:
      formData.get("tax_enabled") === "on" || formData.get("tax_enabled") === "true",
    default_tax_rate_percent: formData.get("default_tax_rate_percent"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("businesses")
    .update({
      tax_enabled: parsed.data.tax_enabled,
      default_tax_rate_bps: Math.round(parsed.data.default_tax_rate_percent * 100),
      currency: parsed.data.currency,
      locale: parsed.data.currency === "INR" ? "en-IN" : "en-US",
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { success: "Tax & currency settings updated" };
}

export async function uploadLogoAction(formData: FormData): Promise<SettingsResult> {
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Choose a logo file" };
  if (file.size > 2 * 1024 * 1024) return { error: "Logo must be under 2MB" };

  const { supabase, tenantId } = await getActiveMembership();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${tenantId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(path);

  const { error } = await supabase
    .from("businesses")
    .update({ logo_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: "Logo uploaded" };
}
