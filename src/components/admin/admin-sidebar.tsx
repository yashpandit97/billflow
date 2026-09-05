"use client";

import { ownerAdminLogoutAction } from "@/app/actions/owner-admin";
import { BrandMark } from "@/components/landing/brand-logo";
import { cn } from "@/lib/utils";
import {
  Building2,
  Gift,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircle,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: Wallet },
  { href: "/admin/referrals", label: "Referrals", icon: Gift },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/reports", label: "Reports", icon: LineChart },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <BrandMark size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">BillMoney Admin</p>
          <p className="truncate text-xs text-muted-foreground">Platform ops</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={() => void ownerAdminLogoutAction()}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
