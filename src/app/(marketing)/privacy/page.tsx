import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Billflow privacy policy.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell mainClassName="flex-1">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>
        <div className="prose prose-invert mt-8 max-w-none space-y-4 text-sm text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
          <section>
            <h2>Overview</h2>
            <p>
              Billflow (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides billing and invoicing
              software for businesses. This policy describes how we handle information
              when you use our website and application.
            </p>
          </section>
          <section>
            <h2>Information we collect</h2>
            <p>
              When you create an account, we collect information you provide such as
              your email address, business details, products, customers, and billing
              records. We use this data to provide the service you signed up for.
            </p>
          </section>
          <section>
            <h2>How we use information</h2>
            <p>
              We use your information to operate Billflow, authenticate users, generate
              invoices, provide reports, and improve the product. We do not sell your
              business data.
            </p>
          </section>
          <section>
            <h2>Data security</h2>
            <p>
              We use industry-standard security practices including encrypted connections
              and access controls. Each business&apos;s data is isolated from other tenants.
            </p>
          </section>
          <section>
            <h2>Contact</h2>
            <p>
              For privacy questions, contact{" "}
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
