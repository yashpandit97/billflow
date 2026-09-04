import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact BillMoney for product questions and support.",
};

export default function ContactPage() {
  return (
    <MarketingShell mainClassName="flex-1">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          <p>
            Have a question about BillMoney or need help getting started? We&apos;d love
            to hear from you.
          </p>
          <p>
            Email:{" "}
            <a
              href="mailto:support@billmoney.app"
              className="text-primary hover:underline"
            >
              support@billmoney.app
            </a>
          </p>
          <p className="text-sm">
            For account-specific issues, please sign in and use the in-app settings
            or contact your business administrator.
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
