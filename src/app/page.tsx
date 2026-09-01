import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Receipt className="size-3.5" />
          </span>
          Billflow
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get started
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Multi-tenant billing
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Billing that feels like a modern POS
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
          Create invoices, accept UPI with your QR, and print professional bills —
          built for cafes, retail, and service businesses.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
