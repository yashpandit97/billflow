"use client";

import { appendGuestOrderAction } from "@/app/actions/public-menu";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency/format";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  unit: string;
};

type MenuBusiness = {
  name: string;
  logo_url: string | null;
  currency: string;
  locale: string;
  primary_color: string;
};

export function GuestMenuClient({
  slug,
  token,
  business,
  tableName,
  products,
}: {
  slug: string;
  token: string;
  business: MenuBusiness;
  tableName: string;
  products: MenuProduct[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const cartItems = useMemo(
    () =>
      products
        .map((p) => ({ product: p, quantity: qty[p.id] ?? 0 }))
        .filter((x) => x.quantity > 0),
    [products, qty]
  );

  const cartTotal = cartItems.reduce(
    (sum, x) => sum + x.product.selling_price * x.quantity,
    0
  );

  function setProductQty(id: string, next: number) {
    setQty((prev) => {
      const value = Math.max(0, next);
      if (value === 0) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: value };
    });
  }

  function sendOrder() {
    if (!cartItems.length) {
      toast.error("Add at least one item");
      return;
    }
    startTransition(async () => {
      const result = await appendGuestOrderAction({
        slug,
        token,
        items: cartItems.map((x) => ({
          product_id: x.product.id,
          quantity: x.quantity,
        })),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setQty({});
      setSent(true);
      toast.success("Order sent to your table");
    });
  }

  return (
    <div className="mx-auto min-h-svh max-w-lg bg-background text-foreground">
      <header
        className="border-b px-4 py-5"
        style={{ borderColor: `${business.primary_color}33` }}
      >
        <div className="flex items-center gap-3">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt=""
              className="h-12 w-12 rounded-lg border object-contain"
            />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {business.name}
            </h1>
            <p className="text-sm text-muted-foreground">{tableName}</p>
          </div>
        </div>
      </header>

      {sent ? (
        <div className="space-y-3 px-4 py-6">
          <p className="text-sm text-muted-foreground">
            Your order was sent. Staff will prepare it. You can add more items
            anytime.
          </p>
          <Button variant="outline" onClick={() => setSent(false)}>
            Order more
          </Button>
        </div>
      ) : null}

      <ul className="divide-y pb-28">
        {products.map((product) => {
          const q = qty[product.id] ?? 0;
          return (
            <li key={product.id} className="flex items-start gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.name}</p>
                {product.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                ) : null}
                <p className="mt-2 text-sm">
                  {formatCurrency(product.selling_price, {
                    code: business.currency,
                    locale: business.locale,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {q > 0 ? (
                  <>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      type="button"
                      onClick={() => setProductQty(product.id, q - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{q}</span>
                  </>
                ) : null}
                <Button
                  size="icon-sm"
                  variant={q > 0 ? "outline" : "default"}
                  type="button"
                  onClick={() => setProductQty(product.id, q + 1)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
        {!products.length ? (
          <li className="px-4 py-16 text-center text-sm text-muted-foreground">
            Menu is empty right now.
          </li>
        ) : null}
      </ul>

      {cartItems.length ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {cartItems.reduce((s, x) => s + x.quantity, 0)} items
              </p>
              <p className="font-semibold">
                {formatCurrency(cartTotal, {
                  code: business.currency,
                  locale: business.locale,
                })}
              </p>
            </div>
            <Button disabled={pending} onClick={sendOrder}>
              <ShoppingBag className="size-4" />
              {pending ? "Sending…" : "Send order"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
