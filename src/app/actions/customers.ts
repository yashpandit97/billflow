"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { customerSchema } from "@/lib/validation/schemas";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { revalidatePath } from "next/cache";

export type CustomerActionResult = {
  error?: string;
  success?: string;
  customerId?: string;
};

export async function upsertCustomerAction(
  _prev: CustomerActionResult,
  formData: FormData
): Promise<CustomerActionResult> {
  const id = formData.get("id") as string | null;
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || "",
    email: formData.get("email") || "",
    address: formData.get("address") || "",
    tax_id: formData.get("tax_id") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let phone: string | null = parsed.data.phone || null;
  if (phone) {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized.ok) return { error: normalized.error };
    phone = normalized.e164;
  }

  const { supabase, tenantId } = await getActiveMembership();
  const payload = {
    tenant_id: tenantId,
    name: parsed.data.name,
    phone,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    tax_id: parsed.data.tax_id || null,
  };

  if (id) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    revalidatePath("/billing");
    return { success: "Customer updated", customerId: id };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/customers");
  revalidatePath("/billing");
  return { success: "Customer created", customerId: data.id };
}

export async function deleteCustomerAction(customerId: string) {
  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: "Customer deleted" };
}
