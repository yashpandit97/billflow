"use server";

import {
  OWNER_ADMIN_COOKIE,
  createOwnerAdminToken,
  ownerAdminCookieOptions,
  verifyOwnerCredentials,
} from "@/lib/admin/session";
import { formString } from "@/lib/forms";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type OwnerAdminActionResult = {
  error?: string;
};

export async function ownerAdminLoginAction(
  _prev: OwnerAdminActionResult,
  formData: FormData
): Promise<OwnerAdminActionResult> {
  const username = formString(formData, "username");
  const password = formString(formData, "password");

  if (!username || !password) {
    return { error: "Username and password are required" };
  }

  if (!verifyOwnerCredentials(username, password)) {
    return { error: "Invalid username or password" };
  }

  const token = await createOwnerAdminToken();
  const cookieStore = await cookies();
  cookieStore.set(OWNER_ADMIN_COOKIE, token, ownerAdminCookieOptions());

  redirect("/admin");
}

export async function ownerAdminLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.set(OWNER_ADMIN_COOKIE, "", ownerAdminCookieOptions(0));
  redirect("/admin/login");
}
