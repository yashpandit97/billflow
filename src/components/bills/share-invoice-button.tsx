"use client";

import { sendInvoiceEmailAction } from "@/app/actions/email";
import { downloadInvoicePdfAction } from "@/app/actions/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildInvoiceShareText } from "@/lib/invoice/share-message";
import { Copy, Mail, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

function base64ToFile(base64: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: "application/pdf" });
}

export function ShareInvoiceButton({
  billId,
  invoiceNumber,
  businessName,
  customerName,
  totalMinor,
  currency,
  locale,
  paymentMethod,
  className,
  size = "default",
}: {
  billId: string;
  invoiceNumber: string;
  businessName: string;
  customerName?: string | null;
  totalMinor: number;
  currency: string;
  locale: string;
  paymentMethod?: string | null;
  className?: string;
  size?: "default" | "lg";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [fallbackFilename, setFallbackFilename] = useState("invoice.pdf");

  const message = buildInvoiceShareText({
    customerName,
    businessName,
    invoiceNumber,
    totalMinor,
    currency,
    locale,
    paymentMethod,
  });

  function share() {
    startTransition(async () => {
      const pdf = await downloadInvoicePdfAction(billId);
      if (pdf.error || !pdf.base64) {
        toast.error(pdf.error ?? "Could not generate PDF");
        return;
      }

      const filename = pdf.filename || `invoice-${invoiceNumber}.pdf`;
      setFallbackMessage(message);
      setFallbackFilename(filename);

      const file = base64ToFile(pdf.base64, filename);

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: `Invoice ${invoiceNumber}`,
              text: message,
              files: [file],
            });
            return;
          }
          await navigator.share({
            title: `Invoice ${invoiceNumber}`,
            text: message,
          });
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
        }
      }

      setFallbackOpen(true);
    });
  }

  function downloadPdf() {
    startTransition(async () => {
      const pdf = await downloadInvoicePdfAction(billId);
      if (pdf.error || !pdf.base64) {
        toast.error(pdf.error ?? "Could not generate PDF");
        return;
      }
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${pdf.base64}`;
      link.download = pdf.filename || fallbackFilename;
      link.click();
    });
  }

  function sendBillToCustomer() {
    startTransition(async () => {
      const res = await sendInvoiceEmailAction(billId);
      if (res.error) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success(res.success ?? "Invoice emailed to customer");
      setFallbackOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        className={className}
        disabled={pending}
        onClick={share}
      >
        <Share2 className="size-4" />
        Share Invoice
      </Button>

      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Email the invoice PDF to the customer, or download it and share it
            yourself.
          </p>
          <textarea
            readOnly
            className="min-h-[140px] w-full rounded-lg border border-input bg-muted/30 p-3 text-sm"
            value={fallbackMessage}
          />
          <div className="grid gap-2">
            <Button onClick={sendBillToCustomer} disabled={pending}>
              <Mail className="size-4" />
              {pending ? "Sending…" : "Send bill to customer"}
            </Button>
            <Button variant="outline" onClick={downloadPdf} disabled={pending}>
              Download PDF
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                void navigator.clipboard.writeText(fallbackMessage);
                toast.success("Message copied");
              }}
            >
              <Copy className="size-4" />
              Copy message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
