"use client";

import {
  cancelBillAction,
  duplicateBillAction,
  updatePaymentStatusAction,
} from "@/app/actions/bills";
import { downloadInvoicePdfAction } from "@/app/actions/whatsapp";
import { RecordRefundDialog } from "@/components/bills/record-refund-dialog";
import { ShareInvoiceButton } from "@/components/bills/share-invoice-button";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ban,
  CheckCircle2,
  Copy,
  FileDown,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function BillActions({
  billId,
  status,
  paymentStatus,
  tabLabel,
  canCancel = true,
  canRefund = false,
  refundMaxMajor = 0,
  currency = "INR",
  locale = "en-IN",
  businessName,
  invoiceNumber,
  totalMinor,
  customerName,
  customerEmail,
  paymentMethod,
}: {
  billId: string;
  status: string;
  paymentStatus?: string;
  tabLabel?: string | null;
  canCancel?: boolean;
  canRefund?: boolean;
  refundMaxMajor?: number;
  currency?: string;
  locale?: string;
  businessName: string;
  invoiceNumber: string;
  totalMinor: number;
  customerName?: string | null;
  customerEmail?: string | null;
  paymentMethod?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const canShare = status === "paid";

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <Link
            href={`/billing?tab=${billId}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue on POS
            {tabLabel ? ` · ${tabLabel}` : ""}
          </Link>
        ) : null}
        {canShare ? (
          <ShareInvoiceButton
            billId={billId}
            invoiceNumber={invoiceNumber}
            businessName={businessName}
            customerName={customerName}
            customerEmail={customerEmail}
            totalMinor={totalMinor}
            currency={currency}
            locale={locale}
            paymentMethod={paymentMethod}
            className="h-10"
          />
        ) : null}
        <Link
          href={`/bills/${billId}/print`}
          target="_blank"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
        >
          <Printer className="size-4" />
          Print
        </Link>
        <Button
          variant="outline"
          className="h-10"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const pdf = await downloadInvoicePdfAction(billId);
              if (pdf.error || !pdf.base64) {
                toast.error(pdf.error ?? "PDF failed");
                return;
              }
              const link = document.createElement("a");
              link.href = `data:application/pdf;base64,${pdf.base64}`;
              link.download = pdf.filename || "invoice.pdf";
              link.click();
            });
          }}
        >
          <FileDown className="size-4" />
          PDF
        </Button>
        <Button
          variant="outline"
          className="h-10"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await duplicateBillAction(billId);
              if (res.error) toast.error(res.error);
              else if (res.billId) {
                toast.success("Invoice duplicated");
                router.push(`/bills/${res.billId}`);
              }
            });
          }}
        >
          <Copy className="size-4" />
          Duplicate
        </Button>
        {status !== "cancelled" && paymentStatus === "pending" ? (
          <Button
            variant="outline"
            className="h-10"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await updatePaymentStatusAction(billId, "paid");
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Marked as payment received");
                  router.refresh();
                }
              });
            }}
          >
            <CheckCircle2 className="size-4" />
            Mark paid
          </Button>
        ) : null}
        {canRefund && status === "paid" ? (
          <Button variant="outline" className="h-10" onClick={() => setRefundOpen(true)}>
            Record refund
          </Button>
        ) : null}
        {status !== "cancelled" && canCancel ? (
          <>
            <Button
              variant="destructive"
              className="h-10"
              disabled={pending}
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="size-4" />
              Cancel
            </Button>
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The invoice will be marked cancelled. Line items are preserved
                    for your records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      startTransition(async () => {
                        const res = await cancelBillAction(billId);
                        if (res.error) toast.error(res.error);
                        else {
                          toast.success("Invoice cancelled");
                          setCancelOpen(false);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Cancel invoice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>

      <RecordRefundDialog
        billId={billId}
        maxAmountMajor={refundMaxMajor}
        currency={currency}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
    </div>
  );
}
