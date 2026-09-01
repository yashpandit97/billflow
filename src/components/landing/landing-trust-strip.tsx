import { Check } from "lucide-react";
import { LANDING_TRUST_ITEMS } from "@/lib/landing/constants";

export function LandingTrustStrip() {
  return (
    <section aria-label="Key benefits" className="border-y border-border/60 bg-secondary/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 py-5 sm:px-6">
        {LANDING_TRUST_ITEMS.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Check className="size-4 shrink-0 text-primary" aria-hidden />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
