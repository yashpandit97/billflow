import { ArrowRight, Gift } from "lucide-react";
import { ButtonLink } from "@/components/landing/button-link";

export function LandingReferral() {
  return (
    <section className="border-y border-border/60 bg-secondary/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Gift className="size-4" />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase">
                Refer &amp; earn
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Help another business. Get a month free.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Share your referral link. When another business signs up and becomes a
              paying customer, you earn one free month on your subscription.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <ol className="space-y-3 text-sm">
              {[
                "Share your referral link",
                "Another business signs up",
                "They become a paying customer",
                "You get 1 month free",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
              {[
                ["1 referral", "1 free month"],
                ["5 referrals", "5 free months"],
                ["10 referrals", "10 free months"],
              ].map(([count, reward]) => (
                <div key={count} className="rounded-lg bg-secondary/80 p-2.5">
                  <p className="font-medium">{count}</p>
                  <p className="text-muted-foreground">{reward}</p>
                </div>
              ))}
            </div>
            <ButtonLink className="mt-5 w-full sm:w-auto" href="/signup">
              Start Free &amp; Get Your Referral Link
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
