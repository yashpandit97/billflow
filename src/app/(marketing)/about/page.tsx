import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";

export const metadata: Metadata = {
  title: "About",
  description: "About BillMoney — simple billing and invoicing for Indian small and medium businesses.",
};

export default function AboutPage() {
  return (
    <MarketingShell mainClassName="flex-1">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">About BillMoney</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            BillMoney is billing and invoicing software built for Indian small and
            medium businesses. We help shop owners, cafes, retailers, and service
            businesses create professional bills without complicated accounting software.
          </p>
          <p>
            Our focus is simple: fast billing, branded invoices, UPI QR on invoices,
            WhatsApp sharing, and clear reports — all for a flat monthly price with no
            transaction fees.
          </p>
          <p>
            BillMoney is designed mobile-first because many businesses run billing directly
            from a phone at the counter.
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
