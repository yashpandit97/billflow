import { LANDING_FAQ } from "@/lib/landing/constants";
import { cn } from "@/lib/utils";

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border/60 bg-secondary/20 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-muted-foreground">
            Straight answers to common questions from business owners.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {LANDING_FAQ.map((item) => (
            <details
              key={item.question}
              className={cn(
                "group rounded-xl border border-border bg-card",
                "open:border-primary/30 open:bg-card"
              )}
            >
              <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium sm:px-5 sm:text-base [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span
                    aria-hidden
                    className="shrink-0 text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <div className="border-t border-border/60 px-4 pb-4 pt-3 text-sm text-muted-foreground sm:px-5">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
