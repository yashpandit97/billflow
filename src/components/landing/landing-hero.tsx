import { ArrowRight } from "lucide-react";
import { ButtonAnchor, ButtonLink } from "@/components/landing/button-link";
import { LandingMockups } from "@/components/landing/landing-mockups";
import {
  LANDING_PRICE,
  LANDING_TRIAL_DAYS,
} from "@/lib/landing/constants";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(212,175,55,0.12),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Simple billing for your business
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Simple billing.
            <br />
            <span className="text-primary">Built for your business.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Create professional bills, manage products, share invoices on WhatsApp,
            and accept UPI payments — without complicated billing software.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink
              size="lg"
              className="h-11 px-5 text-base shadow-[0_0_24px_-6px] shadow-primary/50 hover:shadow-primary/70"
              href="/signup"
            >
              Start Free for {LANDING_TRIAL_DAYS} Days
              <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonAnchor
              variant="outline"
              size="lg"
              className="h-11 px-5 text-base"
              href="#how-it-works"
            >
              See How It Works
            </ButtonAnchor>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {LANDING_PRICE}/month after your free trial. No transaction fees.
            Everything included.
          </p>
        </div>

        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700 motion-safe:delay-150 lg:justify-self-end">
          <LandingMockups />
        </div>
      </div>
    </section>
  );
}
