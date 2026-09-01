"use server";

import { getActiveMembership } from "@/lib/auth/session";
import { formString } from "@/lib/forms";
import { paymentSettingsSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";

export type PaymentActionResult = { error?: string; success?: string };

export async function updatePaymentSettingsAction(
  _prev: PaymentActionResult,
  formData: FormData
): Promise<PaymentActionResult> {
  const parsed = paymentSettingsSchema.safeParse({
    upi_enabled:
      formData.get("upi_enabled") === "on" ||
      formData.get("upi_enabled") === "true",
    upi_id: formString(formData, "upi_id"),
    payment_qr_mode: formString(formData, "payment_qr_mode") || "uploaded",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, tenantId } = await getActiveMembership();
  const { error } = await supabase.from("payment_settings").upsert({
    business_id: tenantId,
    upi_enabled: parsed.data.upi_enabled,
    upi_id: parsed.data.upi_id || null,
    payment_qr_mode: parsed.data.payment_qr_mode,
  });

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/billing");
  revalidatePath("/bills");
  return { success: "Payment settings updated" };
}

export async function uploadUpiQrAction(
  formData: FormData
): Promise<PaymentActionResult> {
  const file = formData.get("qr") as File | null;
  if (!file || file.size === 0) return { error: "Choose a QR image file" };
  if (file.size > 2 * 1024 * 1024) return { error: "QR image must be under 2MB" };

  const { supabase, tenantId } = await getActiveMembership();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${tenantId}/qr.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("upi-qr")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("upi-qr").getPublicUrl(path);

  const { error } = await supabase.from("payment_settings").upsert({
    business_id: tenantId,
    upi_qr_code_url: `${publicUrl}?t=${Date.now()}`,
    upi_enabled: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/bills");
  return { success: "UPI QR uploaded" };
}

export async function removeUpiQrAction(): Promise<PaymentActionResult> {
  const { supabase, tenantId } = await getActiveMembership();

  const { data: settings } = await supabase
    .from("payment_settings")
    .select("upi_qr_code_url")
    .eq("business_id", tenantId)
    .maybeSingle();

  if (settings?.upi_qr_code_url) {
    const { data: files } = await supabase.storage.from("upi-qr").list(tenantId);
    if (files?.length) {
      await supabase.storage
        .from("upi-qr")
        .remove(files.map((f) => `${tenantId}/${f.name}`));
    }
  }

  const { error } = await supabase
    .from("payment_settings")
    .update({ upi_qr_code_url: null })
    .eq("business_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { success: "UPI QR removed" };
}
