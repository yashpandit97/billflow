import { FirstProductForm } from "@/components/onboarding/first-product-form";
import { BusinessSetupForm } from "@/components/onboarding/business-setup-form";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Receipt } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const step = params.step === "product" ? "product" : "business";

  let defaultTaxPercent = 18;
  if (step === "product") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from("business_members")
        .select("businesses(default_tax_rate_bps)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const business = membership?.businesses as
        | { default_tax_rate_bps: number }
        | { default_tax_rate_bps: number }[]
        | null;
      const bps = Array.isArray(business)
        ? business[0]?.default_tax_rate_bps
        : business?.default_tax_rate_bps;
      if (bps != null) defaultTaxPercent = bps / 100;
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/50 px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Receipt className="size-4" />
        </span>
        Billflow
      </Link>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={step === "business" ? "text-foreground" : ""}>1. Business</span>
          <span>/</span>
          <span className={step === "product" ? "text-foreground" : ""}>2. First product</span>
        </div>
        {step === "business" ? (
          <>
            <h1 className="mb-1 text-xl font-semibold tracking-tight">Set up your business</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              This information appears on your invoices.
            </p>
            <BusinessSetupForm />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold tracking-tight">Add your first product</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              You can always add more from the Products page.
            </p>
            <FirstProductForm defaultTaxPercent={defaultTaxPercent} />
          </>
        )}
      </div>
    </div>
  );
}
