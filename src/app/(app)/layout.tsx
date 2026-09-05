import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SubscriptionPaywall } from "@/components/subscription/subscription-paywall";
import { Toaster } from "@/components/ui/sonner";
import { getActiveMembership, getProfile } from "@/lib/auth/session";
import {
  describeSubscription,
  getTenantSubscription,
} from "@/lib/subscription/service";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function paywallReason(
  label: string
): "trial_ended" | "expired" | "revoked" | "past_due" {
  if (label === "past_due") return "past_due";
  if (label === "cancelled") return "revoked";
  if (label === "expired") return "expired";
  return "trial_ended";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, user, supabase, tenantId } = await getActiveMembership();
  const profile = await getProfile();
  const sub = await getTenantSubscription(supabase, tenantId);
  const meta = describeSubscription(sub);

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const allowWhileBlocked = pathname.startsWith("/settings");

  if (!meta.canUseApp && !allowWhileBlocked) {
    return (
      <div className="flex h-svh overflow-hidden bg-background">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            businessName={business.name}
            userEmail={user.email ?? ""}
            userName={profile?.full_name}
          />
          <main className="flex-1 overflow-y-auto">
            <SubscriptionPaywall
              businessName={business.name}
              reason={paywallReason(meta.label)}
            />
          </main>
        </div>
        <Toaster richColors position="top-right" theme="dark" />
      </div>
    );
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <AppSidebar businessName={business.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          businessName={business.name}
          userEmail={user.email ?? ""}
          userName={profile?.full_name}
        />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  );
}
