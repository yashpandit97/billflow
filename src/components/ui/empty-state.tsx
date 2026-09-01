import { cn } from "@/lib/utils";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-zinc-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
