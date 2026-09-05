import {
  IndianRupee,
  Smartphone,
  Sparkles,
  MessageCircle,
  Layers,
  Store,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LANDING_PRICE } from "@/lib/landing/constants";

const reasons = [
  {
    icon: Sparkles,
    title: "Simple",
    description:
      "Create bills quickly without navigating complicated accounting workflows.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    description:
      "Run your billing directly from your phone. No computer required.",
  },
  {
    icon: Store,
    title: "Professional",
    description:
      "Generate clean, branded invoices that make your business look professional.",
  },
  {
    icon: MessageCircle,
    title: "Connected",
    description:
      "Share invoices by email and support UPI payments with your own QR.",
  },
  {
    icon: IndianRupee,
    title: "Transparent pricing",
    description: `${LANDING_PRICE}/month. No percentage cut from sales. No confusing feature tiers.`,
  },
  {
    icon: Layers,
    title: "Built for real businesses",
    description:
      "Designed around everyday billing workflows rather than enterprise complexity.",
  },
];

export function LandingWhy() {
  return (
    <section id="why-us" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Traditional billing and accounting software can feel unnecessarily
            complicated for small businesses. BillMoney focuses on what matters:
            fast billing, professional invoices, and clear pricing.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((item) => (
            <Card key={item.title} size="sm" className="border-border/80 bg-card/80">
              <CardContent>
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
