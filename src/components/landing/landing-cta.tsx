import { ButtonLink } from "@/components/landing/button-link";
import {
  LANDING_PRICE,
  LANDING_TRIAL_DAYS,
} from "@/lib/landing/constants";

export function LandingCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.15),transparent_60%)]"
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to simplify your billing?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Start free for {LANDING_TRIAL_DAYS} days. {LANDING_PRICE}/month after that.
              No transaction fees. No complicated plans.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink
                size="lg"
                className="h-11 min-w-[220px] px-6 text-base shadow-[0_0_28px_-4px] shadow-primary/60"
                href="/signup"
              >
                Start Free for {LANDING_TRIAL_DAYS} Days
              </ButtonLink>
              <ButtonLink
                variant="outline"
                size="lg"
                className="h-11 min-w-[140px] px-6 text-base"
                href="/login"
              >
                Log In
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
