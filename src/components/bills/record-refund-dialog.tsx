"use client";

import { recordPartialRefundAction } from "@/app/actions/bills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function RecordRefundDialog({
  billId,
  maxAmountMajor,
  currency,
  open,
  onOpenChange,
}: {
  billId: string;
  maxAmountMajor: number;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordPartialRefundAction({
        bill_id: billId,
        amount: Number(amount),
        reason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund recorded");
      onOpenChange(false);
      setAmount("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record partial refund</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="refund-amount">Amount ({currency})</Label>
            <Input
              id="refund-amount"
              type="number"
              min={0.01}
              max={maxAmountMajor}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Maximum refundable: {maxAmountMajor.toFixed(2)}
            </p>
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            Record refund
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
