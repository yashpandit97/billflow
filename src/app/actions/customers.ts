"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { assertTenantCanUseApp } from "@/lib/subscription/service";
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
  const { supabase, tenantId } = await getActiveMembership();
  const gate = await assertTenantCanUseApp(supabase, tenantId);
  if (!gate.ok) return { error: gate.error };

  const billId = (formData.get("billId") as string | null)?.trim() || "";
  let id = (formData.get("id") as string | null)?.trim() || "";

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

  if (billId && !parsed.data.email) {
    return { error: "Email is required to send this invoice." };
  }

  if (billId) {
    const { data: bill } = await supabase
      .from("bills")
      .select("id, customer_id, status")
      .eq("id", billId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!bill) return { error: "Invoice not found" };
    if (bill.status === "cancelled") {
      return { error: "Cannot update a cancelled invoice" };
    }
    if (!id && bill.customer_id) id = bill.customer_id;
  }

  let phone: string | null = parsed.data.phone || null;
  if (phone) {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized.ok) return { error: normalized.error };
    phone = normalized.e164;
  }

  const payload = {
    tenant_id: tenantId,
    name: parsed.data.name,
    phone,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    tax_id: parsed.data.tax_id || null,
  };

  let customerId = id || "";

  if (id) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { error: error.message };
    customerId = data.id;
  }

  if (billId) {
    const { error: billError } = await supabase
      .from("bills")
      .update({ customer_id: customerId })
      .eq("id", billId)
      .eq("tenant_id", tenantId);
    if (billError) return { error: billError.message };
    revalidatePath(`/bills/${billId}`);
  }

  revalidatePath("/customers");
  if (customerId) revalidatePath(`/customers/${customerId}`);
  revalidatePath("/billing");
  return {
    success: id ? "Customer updated" : "Customer created",
    customerId,
  };
}

export async function deleteCustomerAction(customerId: string) {
  const { supabase, tenantId } = await getActiveMembership();
  const gate = await assertTenantCanUseApp(supabase, tenantId);
  if (!gate.ok) return { error: gate.error };

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: "Customer deleted" };
}
