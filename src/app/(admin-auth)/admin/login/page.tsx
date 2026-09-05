import { OwnerAdminLoginForm } from "@/components/admin/owner-admin-login-form";
import { BrandMark } from "@/components/landing/brand-logo";
import {
  OWNER_ADMIN_COOKIE,
  verifyOwnerAdminToken,
} from "@/lib/admin/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function OwnerAdminLoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OWNER_ADMIN_COOKIE)?.value;
  if (await verifyOwnerAdminToken(token)) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <BrandMark size={32} />
            <span className="text-lg font-semibold tracking-tight">BillMoney</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Platform owner login
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage trials, subscriptions, and earnings.
          </p>
        </div>
        <OwnerAdminLoginForm />
      </div>
    </div>
  );
}
