import { Building2, Receipt, Share2 } from "lucide-react";

const steps = [
  {
    step: "1",
    icon: Building2,
    title: "Set up your business",
    description:
      "Add your business information, products, logo, and UPI QR. Takes just a few minutes.",
  },
  {
    step: "2",
    icon: Receipt,
    title: "Create your first bill",
    description:
      "Search products, add quantities, apply discounts, and generate a professional invoice.",
  },
  {
    step: "3",
    icon: Share2,
    title: "Share and get paid",
    description:
      "Print it, download it, or send it directly to your customer on WhatsApp.",
  },
];

export function LandingHow() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-secondary/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Up and running in three steps
          </h2>
          <p className="mt-4 text-muted-foreground">
            No lengthy setup. No training manuals. Start billing the same day.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((item, index) => (
            <li
              key={item.title}
              className="relative rounded-xl border border-border bg-card p-6"
            >
              {index < steps.length - 1 ? (
                <div
                  aria-hidden
                  className="absolute right-0 top-1/2 hidden h-px w-6 translate-x-full bg-border md:block"
                />
              ) : null}
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <item.icon className="size-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
