import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function MockCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-lg ring-1 ring-foreground/5 sm:p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-secondary/80 p-2.5 sm:p-3", className)}>
      <p className="text-[10px] text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">{value}</p>
    </div>
  );
}

export function LandingMockups() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Desktop dashboard mockup */}
      <MockCard className="relative z-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Your Business</p>
            <p className="text-sm font-semibold">Dashboard</p>
          </div>
          <Badge variant="outline" className="text-[10px] sm:text-xs">
            Today
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Today's Sales" value="₹24,850" className="col-span-2" />
          <StatTile label="Bills" value="38" />
          <StatTile label="Pending" value="₹4,200" className="col-span-3 sm:col-span-1" />
        </div>
        <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-2.5">
          <p className="mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide sm:text-xs">
            Recent Bills
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm">
            {[
              ["#1024", "₹2,450"],
              ["#1023", "₹1,200"],
              ["#1022", "₹4,800"],
            ].map(([num, amt]) => (
              <li key={num} className="flex justify-between tabular-nums">
                <span className="text-muted-foreground">{num}</span>
                <span className="font-medium">{amt}</span>
              </li>
            ))}
          </ul>
        </div>
      </MockCard>

      {/* Mobile POS mockup */}
      <MockCard className="absolute -bottom-6 -right-2 z-20 w-[42%] max-w-[160px] sm:-bottom-8 sm:-right-4 sm:max-w-[180px]">
        <p className="mb-2 text-[10px] font-semibold">New Bill</p>
        <div className="space-y-1.5">
          <div className="rounded-md bg-secondary/80 px-2 py-1.5 text-[9px] text-muted-foreground sm:text-[10px]">
            Search products…
          </div>
          <div className="grid grid-cols-2 gap-1">
            {["Masala Chai", "Samosa"].map((item) => (
              <div
                key={item}
                className="rounded-md border border-border/60 bg-background/40 px-1.5 py-2 text-center text-[8px] sm:text-[9px]"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md bg-primary/15 px-2 py-1.5 text-[9px] sm:text-[10px]">
            <span className="font-medium">Total</span>
            <span className="font-semibold text-primary">₹180</span>
          </div>
          <div className="rounded-md bg-primary py-1.5 text-center text-[9px] font-medium text-primary-foreground sm:text-[10px]">
            Complete
          </div>
        </div>
      </MockCard>

      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-3xl bg-primary/5 blur-2xl"
      />
    </div>
  );
}
