import { Check } from "lucide-react";
import { ButtonLink } from "@/components/landing/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LANDING_PRICE,
  LANDING_PRICING_FEATURES,
  LANDING_TRIAL_DAYS,
} from "@/lib/landing/constants";

export function LandingPricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing. No surprises.
          </h2>
          <p className="mt-4 text-muted-foreground">
            One plan. Everything included. We don&apos;t take a percentage of your sales.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <Card className="border-primary/30 bg-card shadow-[0_0_40px_-12px] shadow-primary/25">
            <CardHeader className="text-center">
              <CardTitle className="text-lg font-normal text-muted-foreground">
                Everything included
              </CardTitle>
              <p className="mt-2">
                <span className="text-5xl font-semibold tracking-tight text-foreground">
                  {LANDING_PRICE}
                </span>
                <span className="text-muted-foreground">/month</span>
              </p>
              <p className="text-sm text-primary">
                {LANDING_TRIAL_DAYS} days free to start
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {LANDING_PRICING_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <ButtonLink
                size="lg"
                className="mt-8 h-11 w-full text-base shadow-[0_0_24px_-6px] shadow-primary/50"
                href="/signup"
              >
                Start Free
              </ButtonLink>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-10 max-w-xl space-y-2 text-center text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">
              We don&apos;t take a percentage of your sales.
            </strong>
          </p>
          <p>
            You pay {LANDING_PRICE}/month. That&apos;s it. No transaction fees, no platform
            cuts, no hidden tiers.
          </p>
        </div>
      </div>
    </section>
  );
}
