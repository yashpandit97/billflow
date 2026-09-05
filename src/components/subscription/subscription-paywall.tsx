import { logoutAction } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatSubscriptionPrice } from "@/lib/subscription/constants";
import Link from "next/link";

export function SubscriptionPaywall({
  businessName,
  reason = "trial_ended",
}: {
  businessName: string;
  reason?: "trial_ended" | "expired" | "revoked" | "past_due";
}) {
  const headline =
    reason === "trial_ended"
      ? "Your free trial has ended"
      : reason === "revoked"
        ? "Subscription paused"
        : reason === "past_due"
          ? "Payment needed to continue"
          : "Subscription expired";

  const body =
    reason === "trial_ended"
      ? `Continue using BillMoney for ${formatSubscriptionPrice()}/month. One subscription covers your whole team — no transaction fees.`
      : `Reactivate BillMoney for ${formatSubscriptionPrice()}/month so your team can create bills and share invoices again.`;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{businessName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="w-full rounded-xl border border-border bg-card p-4 text-left text-sm">
        <p className="font-medium">How to activate</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
          <li>Message or call the BillMoney owner who invited you to try the app.</li>
          <li>Ask them to mark your business as subscribed in Admin → Subscriptions.</li>
          <li>Come back here — billing unlocks as soon as they activate you.</li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          You can still open Billing &amp; referrals below to check your plan status.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/settings?tab=billing"
          className={buttonVariants({ variant: "default" })}
        >
          View plan &amp; referrals
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}
