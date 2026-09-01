import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export function MarketingShell({
  children,
  mainClassName,
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <LandingNav />
      <main id="main-content" className={mainClassName ?? "flex-1"}>
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
