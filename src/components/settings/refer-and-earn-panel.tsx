"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildReferralShareMessage } from "@/lib/invoice/share-message";
import { Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";

export function ReferAndEarnPanel({
  referralLink,
  referralCode,
  successfulReferrals,
  freeMonthsEarned,
  pendingReferrals,
  freeMonthsAvailable,
  priceLabel,
  trialEndsAt,
  trialRemaining,
  nextBillingDate,
  status,
  isTrial,
  needsPayment,
}: {
  referralLink: string;
  referralCode: string | null;
  successfulReferrals: number;
  freeMonthsEarned: number;
  pendingReferrals: number;
  freeMonthsAvailable: number;
  priceLabel: string;
  trialEndsAt: string | null;
  trialRemaining?: string | null;
  nextBillingDate: string | null;
  status: string;
  isTrial: boolean;
  needsPayment?: boolean;
}) {
  const shareText = buildReferralShareMessage("BillMoney", referralLink);

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Try BillMoney",
          text: shareText,
          url: referralLink,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    await copyLink();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Gift className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Refer & Earn</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Share BillMoney with another business. When they become a paying customer,
          you get <strong>1 free month</strong> on your subscription.
        </p>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Your referral link</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={referralLink} className="font-mono text-sm" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={copyLink}>
                <Copy className="size-4" />
                Copy
              </Button>
              <Button type="button" onClick={shareLink}>
                <Share2 className="size-4" />
                Share
              </Button>
            </div>
          </div>
          {referralCode ? (
            <p className="text-xs text-muted-foreground">Code: {referralCode}</p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Successful referrals", value: successfulReferrals },
            { label: "Free months earned", value: freeMonthsEarned },
            { label: "Pending referrals", value: pendingReferrals },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Your plan</h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Plan:</span>{" "}
            <span className="font-medium">{priceLabel}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="font-medium capitalize">{status}</span>
          </p>
          {isTrial && trialEndsAt ? (
            <p>
              <span className="text-muted-foreground">Trial ends:</span>{" "}
              {trialRemaining ? (
                <>
                  <strong>{trialRemaining}</strong> remaining ({trialEndsAt})
                </>
              ) : (
                trialEndsAt
              )}
            </p>
          ) : null}
          {needsPayment ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              Your trial has ended. Contact the BillMoney owner to subscribe at{" "}
              {priceLabel}.
            </p>
          ) : null}
          {nextBillingDate ? (
            <p>
              <span className="text-muted-foreground">Next billing date:</span>{" "}
              {nextBillingDate}
            </p>
          ) : null}
          {freeMonthsAvailable > 0 ? (
            <p className="rounded-lg bg-primary/10 p-3 text-primary">
              {freeMonthsAvailable} free month{freeMonthsAvailable > 1 ? "s" : ""}{" "}
              available ({freeMonthsEarned} earned through referrals)
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
