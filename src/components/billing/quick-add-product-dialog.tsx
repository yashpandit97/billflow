"use client";

import { createProductQuickAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/types/database";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export function QuickAddProductDialog({
  open,
  onOpenChange,
  initialName,
  defaultTaxPercent,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  defaultTaxPercent: number;
  onCreated: (product: Product) => void;
}) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [sku, setSku] = useState("");
  const [tax, setTax] = useState(String(defaultTaxPercent));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName(initialName);
      setPrice("");
      setUnit("pcs");
      setSku("");
      setTax(String(defaultTaxPercent));
    });
  }, [open, initialName, defaultTaxPercent]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sellingPrice = Number(price);
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      toast.error("Enter a valid selling price");
      return;
    }

    startTransition(async () => {
      const result = await createProductQuickAction({
        name: name.trim(),
        selling_price: sellingPrice,
        unit: unit.trim() || "pcs",
        sku: sku.trim() || undefined,
        tax_rate_percent: Number(tax) || 0,
      });

      if (result.error || !result.product) {
        toast.error(result.error ?? "Could not create product");
        return;
      }

      toast.success(`“${result.product.name}” added to catalog and bill`);
      onCreated(result.product);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new product</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This item isn&apos;t in your catalog yet. Save it and add it to the
          current bill.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qa-name">Name</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qa-price">Selling price</Label>
              <Input
                id="qa-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-unit">Unit</Label>
              <Input
                id="qa-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qa-sku">SKU (optional)</Label>
              <Input
                id="qa-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qa-tax">Tax %</Label>
              <Input
                id="qa-tax"
                type="number"
                min={0}
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save & add to bill"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
