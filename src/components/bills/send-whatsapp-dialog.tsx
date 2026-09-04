"use client";

import {
  downloadInvoicePdfAction,
  getWhatsAppSendContextAction,
  openWhatsAppDeeplinkAction,
  sendInvoiceWhatsAppAction,
  updateCustomerPhoneForBillAction,
} from "@/app/actions/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export function SendWhatsAppDialog({
  billId,
  open,
  onOpenChange,
}: {
  billId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ctx, setCtx] = useState<Awaited<
    ReturnType<typeof getWhatsAppSendContextAction>
  > | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [needPhone, setNeedPhone] = useState(false);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await getWhatsAppSendContextAction(billId);
      setCtx(data);
      setNeedPhone(!data.phone);
      setPhoneInput(data.phone ?? "");
    });
  }, [open, billId]);

  function savePhone() {
    startTransition(async () => {
      const res = await updateCustomerPhoneForBillAction({
        billId,
        phone: phoneInput,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success);
      const data = await getWhatsAppSendContextAction(billId);
      setCtx(data);
      setNeedPhone(!data.phone);
      router.refresh();
    });
  }

  function sendOfficial() {
    startTransition(async () => {
      const res = await sendInvoiceWhatsAppAction(billId);
      if (res.error) {
        toast.error(res.error);
        if (res.deeplinkUrl) {
          // keep dialog open so user can use Open WhatsApp
          setCtx((prev) =>
            prev ? { ...prev, deeplinkUrl: res.deeplinkUrl } : prev
          );
        }
        router.refresh();
        return;
      }
      toast.success(res.success);
      if (res.warning) toast.message(res.warning);
      onOpenChange(false);
      router.refresh();
    });
  }

  function openDeeplink() {
    startTransition(async () => {
      const res = await openWhatsAppDeeplinkAction(billId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.deeplinkUrl) {
        window.open(res.deeplinkUrl, "_blank", "noopener,noreferrer");
      }
      // Offer PDF download for manual attach
      const pdf = await downloadInvoicePdfAction(billId);
      if (pdf.base64 && pdf.filename) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${pdf.base64}`;
        link.download = pdf.filename;
        link.click();
        toast.message(
          "PDF downloaded — attach it in WhatsApp. Open WhatsApp does not send the PDF automatically."
        );
      } else if (res.success) {
        toast.success(res.success);
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
        </DialogHeader>

        {ctx?.error ? (
          <p className="text-sm text-destructive">{ctx.error}</p>
        ) : needPhone ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Customer WhatsApp number is required to send this invoice.
            </p>
            <div className="space-y-2">
              <Label htmlFor="wa-phone">WhatsApp number</Label>
              <Input
                id="wa-phone"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+91XXXXXXXXXX"
              />
            </div>
            <Button disabled={pending || !phoneInput.trim()} onClick={savePhone}>
              Add WhatsApp Number
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[7rem_1fr] gap-y-2">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{ctx?.customerName || "—"}</span>
              <span className="text-muted-foreground">WhatsApp</span>
              <span className="font-medium">
                {ctx?.phoneDisplay || ctx?.phone || "—"}
              </span>
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{ctx?.invoiceNumber}</span>
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{ctx?.amountFormatted}</span>
            </div>
            {!ctx?.cloudApiReady ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Official WhatsApp sending is not available yet. Use{" "}
                <span className="font-medium">Open WhatsApp</span> to send
                manually (you attach the PDF yourself).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sent from BillMoney’s WhatsApp Business number. Delivery is
                marked delivered only after provider confirmation.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {!needPhone && !ctx?.error ? (
            <>
              {ctx?.cloudApiReady ? (
                <Button disabled={pending} onClick={sendOfficial} className="w-full">
                  {pending ? "Sending…" : "Send Invoice"}
                </Button>
              ) : null}
              <Button
                variant={ctx?.cloudApiReady ? "outline" : "default"}
                disabled={pending}
                onClick={openDeeplink}
                className="w-full"
              >
                Open WhatsApp
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                “Open WhatsApp” opens a chat with a prefilled message and
                downloads the PDF — it does not auto-attach the PDF.
              </p>
            </>
          ) : null}
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
