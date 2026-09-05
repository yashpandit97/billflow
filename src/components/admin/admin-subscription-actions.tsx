"use client";

import {
  grantComplimentarySubscriptionAction,
  recordSubscriptionPaymentAction,
  revokeSubscriptionAction,
} from "@/app/actions/admin-subscriptions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function AdminSubscriptionActions({
  tenantId,
  status,
  isComplimentary,
}: {
  tenantId: string;
  status: string;
  isComplimentary: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(
    key: string,
    action: () => Promise<{ error?: string; success?: string }>
  ) {
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Updated");
      router.refresh();
    });
  }

  const isActive = status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || (isActive && isComplimentary)}
        onClick={() =>
          run("comp", () => grantComplimentarySubscriptionAction(tenantId))
        }
      >
        {busy === "comp" ? "…" : "Grant complimentary"}
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          run("pay", () => recordSubscriptionPaymentAction(tenantId))
        }
      >
        {busy === "pay" ? "…" : "Record ₹999 payment"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending || status === "expired"}
        onClick={() => run("revoke", () => revokeSubscriptionAction(tenantId))}
      >
        {busy === "revoke" ? "…" : "Revoke"}
      </Button>
    </div>
  );
}
