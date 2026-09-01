import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>;

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

type ButtonAnchorProps = React.ComponentProps<"a"> &
  VariantProps<typeof buttonVariants>;

export function ButtonAnchor({
  className,
  variant,
  size,
  ...props
}: ButtonAnchorProps) {
  return (
    <a className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
