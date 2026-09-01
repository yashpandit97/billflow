import Link from "next/link";
import { Receipt } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Receipt className="size-4" />
          </span>
          <span className="text-xl">Billflow</span>
        </Link>
        <p className="text-sm text-muted-foreground">Billing for small businesses</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
