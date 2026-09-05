import {
  OWNER_ADMIN_COOKIE,
  verifyOwnerAdminToken,
} from "@/lib/admin/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requirePlatformAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_ADMIN_COOKIE)?.value;

  if (!(await verifyOwnerAdminToken(token))) {
    redirect("/admin/login");
  }

  const supabase = createServiceClient();
  return { supabase, user: null as null };
}

export async function isOwnerAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_ADMIN_COOKIE)?.value;
  return verifyOwnerAdminToken(token);
}

/** @deprecated Prefer isOwnerAdminAuthenticated — platform_admins table is no longer the gate. */
export async function isPlatformAdminUser() {
  return isOwnerAdminAuthenticated();
}
