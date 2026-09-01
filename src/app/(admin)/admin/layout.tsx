import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  );
}
