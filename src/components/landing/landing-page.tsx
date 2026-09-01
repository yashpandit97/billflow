import { LandingCta } from "@/components/landing/landing-cta";
import { LandingCompare } from "@/components/landing/landing-compare";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingReferral } from "@/components/landing/landing-referral";
import { LandingTrustStrip } from "@/components/landing/landing-trust-strip";
import { LandingWhy } from "@/components/landing/landing-why";

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <LandingNav />
      <main id="main-content">
        <LandingHero />
        <LandingTrustStrip />
        <LandingWhy />
        <LandingFeatures />
        <LandingHow />
        <LandingCompare />
        <LandingReferral />
        <LandingPricing />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
