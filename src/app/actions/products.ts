"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { toMinorUnits } from "@/lib/currency/format";
import { productSchema } from "@/lib/validation/schemas";
import type { Product } from "@/types/database";
import { revalidatePath } from "next/cache";

export type ProductActionResult = { error?: string; success?: string };

export async function upsertProductAction(
  _prev: ProductActionResult,
  formData: FormData
): Promise<ProductActionResult> {
  const id = formData.get("id") as string | null;
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || "",
    description: formData.get("description") || "",
    category_id: formData.get("category_id") || "",
    selling_price: formData.get("selling_price"),
    cost_price: formData.get("cost_price") || "",
    unit: formData.get("unit") || "pcs",
    tax_rate_percent: formData.get("tax_rate_percent") || 0,
    is_active: formData.get("is_active") !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId, user } = await getActiveMembership();
  const payload = {
    tenant_id: tenantId,
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    description: parsed.data.description || null,
    category_id: parsed.data.category_id || null,
    selling_price: toMinorUnits(parsed.data.selling_price),
    cost_price:
      parsed.data.cost_price === "" || parsed.data.cost_price == null
        ? null
        : toMinorUnits(Number(parsed.data.cost_price)),
    unit: parsed.data.unit,
    tax_rate_bps: Math.round(parsed.data.tax_rate_percent * 100),
    is_active: parsed.data.is_active,
  };

  if (id) {
    const { data: existing } = await supabase
      .from("products")
      .select("selling_price")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };

    if (
      existing &&
      existing.selling_price !== payload.selling_price
    ) {
      await supabase.from("product_price_history").insert({
        tenant_id: tenantId,
        product_id: id,
        old_price: existing.selling_price,
        new_price: payload.selling_price,
        changed_by: user.id,
      });
      await supabase.rpc("write_audit_log", {
        p_tenant_id: tenantId,
        p_action: "PRODUCT_PRICE_CHANGED",
        p_entity_type: "product",
        p_entity_id: id,
        p_metadata: {
          old_price: existing.selling_price,
          new_price: payload.selling_price,
        },
      });
    }
  } else {
    const { error } = await supabase.from("products").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/products");
  revalidatePath("/billing");
  return { success: id ? "Product updated" : "Product created" };
}

/** Create a product from the POS and return the row so it can be added to the cart. */
export async function createProductQuickAction(input: {
  name: string;
  selling_price: number;
  unit?: string;
  sku?: string;
  tax_rate_percent?: number;
  description?: string;
}): Promise<{ error?: string; product?: Product }> {
  const parsed = productSchema.safeParse({
    name: input.name,
    sku: input.sku || "",
    description: input.description || "",
    category_id: "",
    selling_price: input.selling_price,
    cost_price: "",
    unit: input.unit || "pcs",
    tax_rate_percent: input.tax_rate_percent ?? 0,
    is_active: true,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId, business } = await getActiveMembership();
  const taxBps =
    parsed.data.tax_rate_percent != null
      ? Math.round(parsed.data.tax_rate_percent * 100)
      : business.default_tax_rate_bps;

  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      description: parsed.data.description || null,
      selling_price: toMinorUnits(parsed.data.selling_price),
      cost_price: null,
      unit: parsed.data.unit,
      tax_rate_bps: taxBps,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create product" };
  }

  revalidatePath("/products");
  revalidatePath("/billing");
  return { product: data as Product };
}

export async function deactivateProductAction(productId: string) {
  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath("/billing");
  return { success: "Product deactivated" };
}

export async function activateProductAction(productId: string) {
  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("products")
    .update({ is_active: true })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath("/billing");
  return { success: "Product activated" };
}

export async function createCategoryAction(name: string) {
  const { supabase, tenantId } = await getActiveMembership();
  const { data, error } = await supabase
    .from("categories")
    .insert({ tenant_id: tenantId, name: name.trim() })
    .select("*")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/products");
  return { data };
}
