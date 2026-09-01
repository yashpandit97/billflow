"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/landing/brand-logo";
import { ButtonLink } from "@/components/landing/button-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LANDING_NAV_LINKS } from "@/lib/landing/constants";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        mounted && scrolled
          ? "border-border/80 bg-background/90 backdrop-blur-md"
          : "border-transparent bg-background"
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <BrandLogo />

        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label="Primary"
        >
          {LANDING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink variant="ghost" size="sm" href="/login">
            Log In
          </ButtonLink>
          <ButtonLink
            size="sm"
            className="shadow-[0_0_20px_-6px] shadow-primary/40 motion-safe:transition-shadow hover:shadow-primary/60"
            href="/signup"
          >
            Start Free
          </ButtonLink>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw-2rem,20rem)]">
            <SheetHeader>
              <SheetTitle>
                <BrandLogo href="/" size="sm" />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
              {LANDING_NAV_LINKS.map((link) => (
                <SheetClose
                  key={link.href}
                  render={
                    <a
                      href={link.href}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    />
                  }
                >
                  {link.label}
                </SheetClose>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              <ButtonLink
                variant="outline"
                size="lg"
                className="w-full"
                href="/login"
                onClick={() => setOpen(false)}
              >
                Log In
              </ButtonLink>
              <ButtonLink
                size="lg"
                className="w-full"
                href="/signup"
                onClick={() => setOpen(false)}
              >
                Start Free
              </ButtonLink>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
