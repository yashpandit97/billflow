"use client";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";

export function TopBar({
  businessName,
  userEmail,
  userName,
}: {
  businessName: string;
  userEmail: string;
  userName?: string | null;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium md:hidden">{businessName}</p>
        <p className="hidden text-sm text-muted-foreground md:block">
          Fast billing for {businessName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void logoutAction()}
        >
          <LogOut className="size-3.5" />
          Log out
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm hover:bg-muted">
            <User className="size-4" />
            <span className="hidden max-w-[140px] truncate sm:inline">
              {userName || userEmail}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {userName || "Account"}
                  </p>
                  <p className="text-xs font-normal">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link
                href="/settings"
                className="flex w-full items-center gap-1.5"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => {
                void logoutAction();
              }}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
