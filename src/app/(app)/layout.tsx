import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { getActiveMembership, getProfile } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, user } = await getActiveMembership();
  const profile = await getProfile();

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
