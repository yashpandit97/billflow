"use server";

import { requirePlatformAdmin } from "@/lib/auth/admin";
import type { TrialDurationUnit } from "@/lib/subscription/constants";
import { formString } from "@/lib/forms";
import { revalidatePath } from "next/cache";

export type PlatformSettingsActionResult = {
  error?: string;
  success?: string;
};

export async function updateTrialDurationAction(
  _prev: PlatformSettingsActionResult,
  formData: FormData
): Promise<PlatformSettingsActionResult> {
  const { supabase } = await requirePlatformAdmin();

  const rawValue = formString(formData, "trial_duration_value");
  const unit = formString(formData, "trial_duration_unit") as TrialDurationUnit;
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < 1 || value > 3650) {
    return { error: "Enter a duration between 1 and 3650" };
  }
  if (!["minutes", "hours", "days"].includes(unit)) {
    return { error: "Invalid duration unit" };
  }

  const { error } = await supabase
    .from("platform_settings")
    .update({
      trial_duration_value: Math.floor(value),
      trial_duration_unit: unit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return { error: error.message || "Could not save trial settings" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  return { success: "Trial duration saved. Applies to new businesses only." };
}
