"use client";

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
  customerEmail,
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
  customerEmail?: string | null;
  paymentMethod?: string | null;
}) {
  return (
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
            Email it to your customer, or view / print it.
          </p>
        </div>
        <div className="grid gap-2">
          <ShareInvoiceButton
            billId={billId}
            invoiceNumber={invoiceNumber}
            businessName={businessName}
            customerName={customerName}
            customerEmail={customerEmail}
            totalMinor={total}
            currency={currency}
            locale={locale}
            paymentMethod={paymentMethod}
            className="h-12 w-full text-base"
            size="lg"
            mode="send"
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
  );
}
