import Link from "next/link";
import { Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  href = "/",
  size = "default",
}: {
  className?: string;
  href?: string;
  size?: "default" | "sm";
}) {
  const iconSize = size === "sm" ? "size-7 rounded-md" : "size-8 rounded-lg";
  const textSize = size === "sm" ? "text-base" : "text-lg";

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span
        className={cn(
          "flex items-center justify-center bg-primary text-primary-foreground",
          iconSize
        )}
      >
        <Receipt className={size === "sm" ? "size-3.5" : "size-4"} />
      </span>
      <span className={textSize}>Billflow</span>
    </Link>
  );
}
