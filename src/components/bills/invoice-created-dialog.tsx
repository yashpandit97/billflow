"use client";

import { SendWhatsAppDialog } from "@/components/bills/send-whatsapp-dialog";
import { ShareInvoiceButton } from "@/components/bills/share-invoice-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency/format";
import Link from "next/link";
import { useState } from "react";

export function InvoiceCreatedDialog({
  open,
  onOpenChange,
  billId,
  invoiceNumber,
  total,
  currency,
  locale,
  businessName,
  customerName,
  paymentMethod,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  locale: string;
  businessName: string;
  customerName?: string | null;
  paymentMethod?: string | null;
}) {
  const [waOpen, setWaOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice ready</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-center">
            <p className="text-lg font-semibold">{invoiceNumber}</p>
            <p className="text-2xl font-semibold">
              {formatCurrency(total, { code: currency, locale })}
            </p>
            <p className="text-sm text-muted-foreground">
              Send it to your customer on WhatsApp, or view / print it.
            </p>
          </div>
          <div className="grid gap-2">
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={() => setWaOpen(true)}
            >
              Send on WhatsApp
            </Button>
            <ShareInvoiceButton
              billId={billId}
              invoiceNumber={invoiceNumber}
              businessName={businessName}
              customerName={customerName}
              totalMinor={total}
              currency={currency}
              locale={locale}
              paymentMethod={paymentMethod}
              className="w-full"
            />
            <Link
              href={`/bills/${billId}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              View invoice
            </Link>
            <Link
              href={`/bills/${billId}/print`}
              target="_blank"
              className="inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              Print
            </Link>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <SendWhatsAppDialog
        billId={billId}
        open={waOpen}
        onOpenChange={setWaOpen}
      />
    </>
  );
}
