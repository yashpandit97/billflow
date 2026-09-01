import { Check, Minus } from "lucide-react";
import { LANDING_COMPARE_ROWS } from "@/lib/landing/constants";

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-primary" aria-label="Yes" />;
  }
  if (value === false) {
    return <Minus className="mx-auto size-4 text-muted-foreground" aria-label="No" />;
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function LandingCompare() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Easier than traditional billing software
          </h2>
          <p className="mt-4 text-muted-foreground">
            Billflow is built for businesses that want billing done simply — without
            enterprise complexity or hidden fees.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 font-medium sm:px-6" scope="col">
                  Feature
                </th>
                <th className="px-4 py-3 text-center font-semibold text-primary sm:px-6" scope="col">
                  Billflow
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground sm:px-6" scope="col">
                  Traditional billing software
                </th>
              </tr>
            </thead>
            <tbody>
              {LANDING_COMPARE_ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-border/60 last:border-0">
                  <th className="px-4 py-3 font-normal sm:px-6" scope="row">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3 text-center sm:px-6">
                    <CellValue value={row.us} />
                  </td>
                  <td className="px-4 py-3 text-center sm:px-6">
                    <CellValue value={row.them} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
