"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { diningTableSchema } from "@/lib/validation/schemas";
import type { DiningTable } from "@/types/database";
import { revalidatePath } from "next/cache";

export type TableActionResult = {
  error?: string;
  success?: string;
  table?: DiningTable;
};

export async function createDiningTableAction(input: {
  name: string;
  sort_order?: number;
}): Promise<TableActionResult> {
  const parsed = diningTableSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid table" };
  }

  const { supabase, tenantId, business } = await getActiveMembership();
  if (!business.open_tabs_enabled) {
    return { error: "Enable restaurant / open tabs mode first" };
  }

  const { data, error } = await supabase
    .from("dining_tables")
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name.trim(),
      sort_order: parsed.data.sort_order,
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create table" };
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { table: data as DiningTable, success: "Table created" };
}

export async function updateDiningTableAction(input: {
  id: string;
  name: string;
  sort_order?: number;
}): Promise<TableActionResult> {
  const parsed = diningTableSchema.safeParse({
    name: input.name,
    sort_order: input.sort_order ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid table" };
  }

  const { supabase, tenantId } = await getActiveMembership();
  const { data, error } = await supabase
    .from("dining_tables")
    .update({
      name: parsed.data.name.trim(),
      sort_order: parsed.data.sort_order,
    })
    .eq("id", input.id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to update table" };
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { table: data as DiningTable, success: "Table updated" };
}

export async function deactivateDiningTableAction(
  tableId: string
): Promise<TableActionResult> {
  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase
    .from("dining_tables")
    .update({ is_active: false })
    .eq("id", tableId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { success: "Table removed" };
}

export async function regenerateTableQrTokenAction(
  tableId: string
): Promise<TableActionResult> {
  const { supabase, tenantId } = await getActiveMembership();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await supabase
    .from("dining_tables")
    .update({ qr_token: token })
    .eq("id", tableId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to regenerate QR" };
  revalidatePath("/settings");
  return { table: data as DiningTable, success: "QR code regenerated" };
}
