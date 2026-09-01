"use client";

import {
  activateProductAction,
  deactivateProductAction,
  upsertProductAction,
  type ProductActionResult,
} from "@/app/actions/products";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, toMajorUnits } from "@/lib/currency/format";
import type { Category, Product } from "@/types/database";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const initial: ProductActionResult = {};

function ProductForm({
  product,
  categories,
  defaultTaxPercent,
  onDone,
}: {
  product?: Product;
  categories: Category[];
  defaultTaxPercent: number;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(upsertProductAction, initial);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      onDone?.();
    }
    if (state.error) toast.error(state.error);
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "pcs"} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={product?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category_id">Category</Label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={product?.category_id ?? ""}
          className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="selling_price">Selling price</Label>
          <Input
            id="selling_price"
            name="selling_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product ? toMajorUnits(product.selling_price) : ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost_price">Cost price</Label>
          <Input
            id="cost_price"
            name="cost_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={
              product?.cost_price != null ? toMajorUnits(product.cost_price) : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax_rate_percent">Tax %</Label>
          <Input
            id="tax_rate_percent"
            name="tax_rate_percent"
            type="number"
            min={0}
            step="0.01"
            defaultValue={
              product ? product.tax_rate_bps / 100 : defaultTaxPercent
            }
          />
        </div>
      </div>
      <input type="hidden" name="is_active" value={product?.is_active === false ? "false" : "true"} />
      <SubmitButton className="w-full">{product ? "Save changes" : "Add product"}</SubmitButton>
    </form>
  );
}

export function ProductsManager({
  products,
  categories,
  currency,
  locale,
  defaultTaxPercent,
}: {
  products: Product[];
  categories: Category[];
  currency: string;
  locale: string;
  defaultTaxPercent: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"name" | "price">("name");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();

  const filtered = useMemo(() => {
    let list = [...products];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    if (status === "active") list = list.filter((p) => p.is_active);
    if (status === "inactive") list = list.filter((p) => !p.is_active);
    list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : a.selling_price - b.selling_price
    );
    return list;
  }, [products, query, status, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
          </select>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add product
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editing}
              categories={categories}
              defaultTaxPercent={defaultTaxPercent}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">SKU</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Tax</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.unit}</div>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {product.sku || "—"}
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(product.selling_price, { code: currency, locale })}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {(product.tax_rate_bps / 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3">
                  <Badge variant={product.is_active ? "default" : "secondary"}>
                    {product.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(product);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {product.is_active ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await deactivateProductAction(product.id);
                          if (res.error) toast.error(res.error);
                          else toast.success(res.success);
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await activateProductAction(product.id);
                          if (res.error) toast.error(res.error);
                          else toast.success(res.success);
                        }}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No products match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
