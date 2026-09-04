import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  href = "/",
  size = "default",
  showWordmark = true,
}: {
  className?: string;
  href?: string;
  size?: "default" | "sm" | "lg";
  showWordmark?: boolean;
}) {
  const iconPx = size === "sm" ? 28 : size === "lg" ? 40 : 32;
  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <Image
        src="/logo.png"
        alt="BillMoney"
        width={iconPx}
        height={iconPx}
        className="shrink-0"
        priority
      />
      {showWordmark ? <span className={textSize}>BillMoney</span> : null}
    </Link>
  );
}

/** Non-link mark for sidebars and locked chrome */
export function BrandMark({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
      priority
    />
  );
}
