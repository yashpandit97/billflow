import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { LANDING_PRICE, LANDING_TRIAL_DAYS } from "@/lib/landing/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Billflow terms of service.",
};

export default function TermsPage() {
  return (
    <MarketingShell mainClassName="flex-1">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>
        <div className="prose prose-invert mt-8 max-w-none space-y-4 text-sm text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
          <section>
            <h2>Service</h2>
            <p>
              Billflow provides billing and invoicing software on a subscription basis.
              By using Billflow, you agree to these terms.
            </p>
          </section>
          <section>
            <h2>Subscription</h2>
            <p>
              New businesses receive a {LANDING_TRIAL_DAYS}-day free trial. After the
              trial, the subscription is {LANDING_PRICE}/month unless cancelled. Billflow
              does not charge transaction fees on your sales.
            </p>
          </section>
          <section>
            <h2>Your responsibilities</h2>
            <p>
              You are responsible for the accuracy of your business information, invoices,
              tax details, and payment configurations including UPI QR codes. Billflow does
              not process customer payments on your behalf.
            </p>
          </section>
          <section>
            <h2>Acceptable use</h2>
            <p>
              You agree not to misuse the service, attempt unauthorized access, or use
              Billflow for unlawful purposes.
            </p>
          </section>
          <section>
            <h2>Contact</h2>
            <p>
              Questions about these terms? Contact{" "}
              <a href="mailto:support@billflow.app" className="text-primary hover:underline">
                support@billflow.app
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </MarketingShell>
  );
}
