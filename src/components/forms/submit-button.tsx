"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  className,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={className} variant={variant} disabled={pending}>
      {pending ? "Please wait…" : children}
    </Button>
  );
}
