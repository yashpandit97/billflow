"use client";

import { logoutAction } from "@/app/actions/auth";
import { BrandMark } from "@/components/landing/brand-logo";
import { cn } from "@/lib/utils";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const desktopNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "New Bill", icon: PlusCircle },
  { href: "/bills", label: "Bills", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/bills", label: "Bills", icon: FileText },
  { href: "/billing", label: "New Bill", icon: PlusCircle, emphasize: true },
  { href: "/products", label: "Products", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <BrandMark size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            BillMoney
          </p>
          <p className="truncate text-xs text-muted-foreground">{businessName}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {desktopNav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
          onClick={() => void logoutAction()}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {mobileNav.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href));
        const Icon = item.icon;
        const emphasize = "emphasize" in item && item.emphasize;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              emphasize && !active && "text-foreground",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon
              className={cn("size-5", emphasize && "size-6 text-primary")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
