"use client";

import {
  cancelBillAction,
  createBillAction,
  createOpenTabAction,
  finalizeDraftBillAction,
  updateDraftBillAction,
} from "@/app/actions/bills";
import { QuickAddProductDialog } from "@/components/billing/quick-add-product-dialog";
import { InvoiceCreatedDialog } from "@/components/bills/invoice-created-dialog";
import { CustomerForm } from "@/components/customers/customers-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { calculateBill } from "@/lib/billing/calculate";
import { formatCurrency, toMinorUnits } from "@/lib/currency/format";
import { defaultPaymentStatus } from "@/lib/billing/payment-status";
import { createClient } from "@/lib/supabase/client";
import type { Bill, BillItem, Customer, DiningTable, Product } from "@/types/database";
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  taxRateBps: number;
  quantity: number;
  lineDiscountMajor: number;
};

type OpenTab = Bill & { bill_items?: BillItem[] };

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
] as const;

function billToCart(bill: OpenTab): CartLine[] {
  return (bill.bill_items ?? [])
    .filter((item) => Boolean(item.product_id))
    .map((item) => ({
      productId: item.product_id as string,
      name: item.product_name,
      unitPrice: item.unit_price,
      taxRateBps: item.tax_rate_bps,
      quantity: Number(item.quantity),
      lineDiscountMajor: item.discount / 100,
    }));
}

export function BillingPos({
  businessName,
  initialProducts,
  customers,
  currency,
  locale,
  taxEnabled,
  defaultTaxPercent = 0,
  openTabsEnabled = false,
  initialOpenTabs = [],
  tables = [],
  initialTabId = null,
}: {
  businessName: string;
  initialProducts: Product[];
  customers: Customer[];
  currency: string;
  locale: string;
  taxEnabled: boolean;
  defaultTaxPercent?: number;
  openTabsEnabled?: boolean;
  initialOpenTabs?: OpenTab[];
  tables?: DiningTable[];
  initialTabId?: string | null;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const checkoutIdempotencyRef = useRef<string | null>(null);

  const [extraProducts, setExtraProducts] = useState<Product[]>([]);
  const products = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of initialProducts) map.set(p.id, p);
    for (const p of extraProducts) map.set(p.id, p);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [initialProducts, extraProducts]);

  const [localTabPatches, setLocalTabPatches] = useState<
    Record<string, Partial<OpenTab>>
  >({});
  const [closedTabIds, setClosedTabIds] = useState<string[]>([]);
  const openTabs = useMemo(() => {
    const closed = new Set(closedTabIds);
    return initialOpenTabs
      .filter((t) => !closed.has(t.id))
      .map((t) => ({ ...t, ...localTabPatches[t.id] }));
  }, [initialOpenTabs, localTabPatches, closedTabIds]);

  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialTabId && initialOpenTabs.some((t) => t.id === initialTabId)
      ? initialTabId
      : initialOpenTabs[0]?.id ?? null
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscountMajor, setBillDiscountMajor] = useState(0);
  const [customerId, setCustomerId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]["value"]>("cash");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">("paid");
  const [notes, setNotes] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [successBill, setSuccessBill] = useState<{
    id: string;
    invoiceNumber: string;
    total: number;
    customerName?: string | null;
    paymentMethod?: string | null;
  } | null>(null);
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [newTabLabel, setNewTabLabel] = useState("");
  const [newTabTableId, setNewTabTableId] = useState("");
  const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const localCustomers = customers;

  const activeTab = useMemo(
    () => openTabs.find((t) => t.id === activeTabId) ?? null,
    [openTabs, activeTabId]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const hydrateFromTab = useCallback((tab: OpenTab | null) => {
    skipNextSave.current = true;
    if (!tab) {
      setCart([]);
      setBillDiscountMajor(0);
      setCustomerId("");
      setNotes("");
      setPaymentMethod("cash");
      setPaymentStatus("paid");
      return;
    }
    setCart(billToCart(tab));
    setBillDiscountMajor(tab.discount / 100);
    setCustomerId(tab.customer_id ?? "");
    setNotes(tab.notes ?? "");
    setPaymentMethod(
      (tab.payment_method as (typeof PAYMENT_METHODS)[number]["value"]) || "cash"
    );
    setPaymentStatus(tab.payment_status === "pending" ? "pending" : "paid");
  }, []);

  const prevTabId = useRef<string | null>(null);
  useEffect(() => {
    if (!openTabsEnabled) return;
    if (prevTabId.current === activeTabId) return;
    prevTabId.current = activeTabId;
    const tab = openTabs.find((t) => t.id === activeTabId) ?? null;
    queueMicrotask(() => hydrateFromTab(tab));
  }, [activeTabId, openTabs, openTabsEnabled, hydrateFromTab]);

  // Realtime: refresh open tabs / active cart when guest orders arrive
  useEffect(() => {
    if (!openTabsEnabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel("open-tabs-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bills" },
        () => {
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_items" },
        (payload) => {
          const billId =
            (payload.new as { bill_id?: string } | null)?.bill_id ??
            (payload.old as { bill_id?: string } | null)?.bill_id;
          if (billId && billId === activeTabId) {
            setDirtyTabs((prev) => ({ ...prev, [billId]: true }));
          }
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [openTabsEnabled, activeTabId, router]);

  // After refresh, re-hydrate active tab if guest updated it
  useEffect(() => {
    if (!openTabsEnabled || !activeTabId) return;
    if (!dirtyTabs[activeTabId]) return;
    const tab = initialOpenTabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    queueMicrotask(() => {
      hydrateFromTab(tab);
      setDirtyTabs((prev) => {
        const next = { ...prev };
        delete next[activeTabId];
        return next;
      });
      toast.message(`“${tab.tab_label || "Tab"}” updated from guest order`);
    });
  }, [initialOpenTabs, activeTabId, dirtyTabs, openTabsEnabled, hydrateFromTab]);

  const filteredProducts = useMemo(() => {
    const active = products.filter((p) => p.is_active);
    if (!debouncedQuery) return active.slice(0, 40);
    const q = debouncedQuery.toLowerCase();
    return active
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [products, debouncedQuery]);

  const noMatches = Boolean(debouncedQuery) && filteredProducts.length === 0;

  const openQuickAdd = useCallback((name: string) => {
    setQuickAddName(name.trim());
    setQuickAddOpen(true);
  }, []);

  const addProduct = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.selling_price,
          taxRateBps: product.tax_rate_bps,
          quantity: 1,
          lineDiscountMajor: 0,
        },
      ];
    });
  }, []);

  const handleProductCreated = useCallback(
    (product: Product) => {
      setExtraProducts((prev) => {
        if (prev.some((p) => p.id === product.id)) return prev;
        return [...prev, product];
      });
      addProduct(product);
      setQuery("");
      setDebouncedQuery("");
      searchRef.current?.focus();
    },
    [addProduct]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setQuery("");
        searchRef.current?.focus();
      }
      if (e.key === "Enter" && document.activeElement === searchRef.current) {
        e.preventDefault();
        if (filteredProducts[0]) {
          addProduct(filteredProducts[0]);
          return;
        }
        const typed = query.trim();
        if (typed) openQuickAdd(typed);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filteredProducts, addProduct, query, openQuickAdd]);

  const calc = useMemo(
    () =>
      calculateBill({
        taxEnabled,
        billDiscount: toMinorUnits(billDiscountMajor),
        lines: cart.map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRateBps: l.taxRateBps,
          lineDiscount: toMinorUnits(l.lineDiscountMajor),
        })),
      }),
    [cart, billDiscountMajor, taxEnabled]
  );

  const draftPayload = useCallback(() => {
    return {
      bill_id: activeTabId!,
      customer_id: customerId || null,
      bill_discount: billDiscountMajor,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      notes: notes || null,
      items: cart.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
        line_discount: l.lineDiscountMajor,
      })),
    };
  }, [
    activeTabId,
    customerId,
    billDiscountMajor,
    paymentMethod,
    paymentStatus,
    notes,
    cart,
  ]);

  // Debounced autosave for open tabs
  useEffect(() => {
    if (!openTabsEnabled || !activeTabId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateDraftBillAction(draftPayload()).then((res) => {
        if (res.error) toast.error(res.error);
        else {
          setLocalTabPatches((prev) => ({
            ...prev,
            [activeTabId]: {
              total: calc.total,
              subtotal: calc.subtotal,
              discount: calc.discount,
              tax: calc.tax,
              customer_id: customerId || null,
              notes: notes || null,
              payment_method: paymentMethod,
              payment_status: paymentStatus,
            },
          }));
        }
      });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    openTabsEnabled,
    activeTabId,
    cart,
    billDiscountMajor,
    customerId,
    notes,
    paymentMethod,
    paymentStatus,
    draftPayload,
    calc.total,
    calc.subtotal,
    calc.discount,
    calc.tax,
  ]);

  function updateQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, quantity) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function completeBill(status: "paid" | "draft" = "paid") {
    if (!cart.length) {
      toast.error("Add at least one product");
      return;
    }

    if (!checkoutIdempotencyRef.current) {
      checkoutIdempotencyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = checkoutIdempotencyRef.current;

    if (openTabsEnabled && activeTabId) {
      if (status === "draft") {
        startTransition(async () => {
          const result = await updateDraftBillAction(draftPayload());
          if (result.error) toast.error(result.error);
          else toast.success("Tab saved");
        });
        return;
      }

      startTransition(async () => {
        const result = await finalizeDraftBillAction({
          ...draftPayload(),
          idempotency_key: idempotencyKey,
        });
        if (result.error) {
          toast.error(result.error);
          if (!result.billId) return;
        } else {
          checkoutIdempotencyRef.current = null;
        }
        setClosedTabIds((prev) => [...prev, activeTabId]);
        setLocalTabPatches((prev) => {
          const next = { ...prev };
          delete next[activeTabId];
          return next;
        });
        setActiveTabId(null);
        setCart([]);
        setCartOpen(false);
        if (result.billId && status === "paid") {
          setSuccessBill({
            id: result.billId,
            invoiceNumber: result.invoiceNumber || "Invoice",
            total: result.total ?? calc.total,
            customerName: localCustomers.find((c) => c.id === customerId)?.name,
            paymentMethod,
          });
          router.refresh();
          return;
        }
        if (result.billId) {
          router.push(`/bills/${result.billId}`);
          router.refresh();
        }
      });
      return;
    }

    startTransition(async () => {
      const result = await createBillAction({
        customer_id: customerId || null,
        bill_discount: billDiscountMajor,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes || null,
        idempotency_key: idempotencyKey,
        items: cart.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          line_discount: l.lineDiscountMajor,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        if (!result.billId) return;
      } else {
        checkoutIdempotencyRef.current = null;
      }

      setCart([]);
      setBillDiscountMajor(0);
      setNotes("");
      setCustomerId("");
      setCartOpen(false);
      if (result.billId && status === "paid") {
        setSuccessBill({
          id: result.billId,
          invoiceNumber: result.invoiceNumber || "Invoice",
          total: result.total ?? calc.total,
          customerName: localCustomers.find((c) => c.id === customerId)?.name,
          paymentMethod,
        });
        router.refresh();
        return;
      }
      if (result.billId) {
        router.push(`/bills/${result.billId}`);
        router.refresh();
      }
    });
  }

  function createTab() {
    startTransition(async () => {
      const result = await createOpenTabAction({
        table_id: newTabTableId || null,
        tab_label: newTabTableId ? null : newTabLabel.trim() || "Takeaway",
      });
      if (result.error || !result.billId) {
        toast.error(result.error ?? "Could not open tab");
        return;
      }
      setNewTabOpen(false);
      setNewTabLabel("");
      setNewTabTableId("");
      setActiveTabId(result.billId);
      router.refresh();
      toast.success("Tab opened");
    });
  }

  function closeActiveTab() {
    if (!activeTabId) return;
    startTransition(async () => {
      const res = await cancelBillAction(activeTabId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tab closed");
      setClosedTabIds((prev) => [...prev, activeTabId]);
      setLocalTabPatches((prev) => {
        const next = { ...prev };
        delete next[activeTabId];
        return next;
      });
      setActiveTabId(null);
      setCart([]);
      router.refresh();
    });
  }

  const occupiedTableIds = useMemo(
    () => new Set(openTabs.map((t) => t.table_id).filter(Boolean) as string[]),
    [openTabs]
  );

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {openTabsEnabled
              ? activeTab?.tab_label || "Select a tab"
              : "Current bill"}
          </h2>
          {cart.length ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCart([])}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          ) : null}
        </div>
        {openTabsEnabled && activeTabId ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-destructive"
            disabled={pending}
            onClick={closeActiveTab}
          >
            Close tab
          </Button>
        ) : null}
        <div className="flex gap-2">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
            disabled={openTabsEnabled && !activeTabId}
          >
            <option value="">Walk-in / no customer</option>
            {localCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
          <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
            <Button
              size="icon-sm"
              variant="outline"
              title="Add customer"
              onClick={() => setCustomerOpen(true)}
            >
              <UserPlus className="size-4" />
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick add customer</DialogTitle>
              </DialogHeader>
              <CustomerForm
                onDone={(id) => {
                  setCustomerOpen(false);
                  if (id) {
                    setCustomerId(id);
                    router.refresh();
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {openTabsEnabled && !activeTabId ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Open or select a tab to start billing.
          </div>
        ) : !cart.length ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
            <ShoppingCart className="mb-3 size-8 opacity-40" />
            Search and click products to add them here.
          </div>
        ) : (
          <ul className="space-y-1">
            {cart.map((line, idx) => {
              const lineNet = calc.lines[idx]?.lineNet ?? 0;
              return (
                <li
                  key={`${line.productId}-${idx}`}
                  className="rounded-lg border border-transparent px-2 py-2 hover:border-border hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(line.unitPrice, { code: currency, locale })}{" "}
                        each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={() => updateQty(line.productId, line.quantity - 1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Input
                        className="h-7 w-14 text-center"
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity}
                        onChange={(e) =>
                          updateQty(line.productId, Number(e.target.value) || 0)
                        }
                      />
                      <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={() => updateQty(line.productId, line.quantity + 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-medium">
                      {formatCurrency(lineNet, { code: currency, locale })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t bg-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Discount</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={billDiscountMajor || ""}
              onChange={(e) => setBillDiscountMajor(Number(e.target.value) || 0)}
              placeholder="0.00"
              disabled={openTabsEnabled && !activeTabId}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment</Label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const method = e.target
                  .value as (typeof PAYMENT_METHODS)[number]["value"];
                setPaymentMethod(method);
                setPaymentStatus(defaultPaymentStatus(method));
              }}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              disabled={openTabsEnabled && !activeTabId}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Money received?</Label>
          <select
            value={paymentStatus}
            onChange={(e) =>
              setPaymentStatus(e.target.value as "pending" | "paid")
            }
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            disabled={openTabsEnabled && !activeTabId}
          >
            <option value="paid">Yes — mark as paid</option>
            <option value="pending">Not yet — customer will pay later</option>
          </select>
        </div>
        <Textarea
          placeholder="Invoice notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={openTabsEnabled && !activeTabId}
        />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(calc.subtotal, { code: currency, locale })}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>
              −{formatCurrency(calc.discount, { code: currency, locale })}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatCurrency(calc.tax, { code: currency, locale })}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>TOTAL</span>
            <span>{formatCurrency(calc.total, { code: currency, locale })}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={
              pending ||
              !cart.length ||
              (openTabsEnabled && !activeTabId)
            }
            onClick={() => completeBill("draft")}
          >
            {openTabsEnabled ? "Save tab" : "Save draft"}
          </Button>
          <Button
            disabled={
              pending ||
              !cart.length ||
              (openTabsEnabled && !activeTabId)
            }
            onClick={() => completeBill("paid")}
          >
            {pending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      {openTabsEnabled ? (
        <div className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2">
          {openTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-left text-sm transition ${
                tab.id === activeTabId
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/60"
              }`}
            >
              <span className="font-medium">{tab.tab_label || "Untitled"}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {formatCurrency(tab.total, { code: currency, locale })}
              </span>
              {dirtyTabs[tab.id] ? (
                <span className="ml-1 text-xs text-primary">•</span>
              ) : null}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setNewTabOpen(true)}>
            + New tab
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col border-r">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or type a new item (Enter)"
                className="pl-9"
                disabled={openTabsEnabled && !activeTabId}
              />
              {query ? (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="md:hidden">
              <Button className="relative" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="size-4" />
                Cart
                {cart.length ? (
                  <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">
                    {cart.length}
                  </span>
                ) : null}
              </Button>
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetContent side="bottom" className="h-[85vh] p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Cart</SheetTitle>
                  </SheetHeader>
                  {cartPanel}
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {openTabsEnabled && !activeTabId ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Open a tab to add items. Guest QR orders appear here automatically.
              </p>
            ) : noMatches ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No product matches “{debouncedQuery}”.
                </p>
                <Button onClick={() => openQuickAdd(debouncedQuery)}>
                  Create &amp; add “{debouncedQuery}”
                </Button>
              </div>
            ) : !filteredProducts.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No products yet. Search and press Enter to create your first item.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                  >
                    <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatCurrency(product.selling_price, {
                        code: currency,
                        locale,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t bg-card p-3 md:hidden">
            <div>
              <p className="text-xs text-muted-foreground">
                {cart.length} item{cart.length === 1 ? "" : "s"}
              </p>
              <p className="text-lg font-semibold">
                {formatCurrency(calc.total, { code: currency, locale })}
              </p>
            </div>
            <Button
              disabled={!cart.length}
              onClick={() => setCartOpen(true)}
            >
              {cart.length ? "Create invoice" : "View cart"}
            </Button>
          </div>
        </div>

        <div className="hidden w-full max-w-md shrink-0 md:flex md:flex-col">
          {cartPanel}
        </div>
      </div>

      <QuickAddProductDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialName={quickAddName}
        defaultTaxPercent={defaultTaxPercent}
        onCreated={handleProductCreated}
      />

      <Dialog open={newTabOpen} onOpenChange={setNewTabOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open new tab</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table (optional)</Label>
              <select
                value={newTabTableId}
                onChange={(e) => setNewTabTableId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">No table / takeaway</option>
                {tables.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={occupiedTableIds.has(t.id)}
                  >
                    {t.name}
                    {occupiedTableIds.has(t.id) ? " (open)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {!newTabTableId ? (
              <div className="space-y-2">
                <Label htmlFor="tab_label">Tab label</Label>
                <Input
                  id="tab_label"
                  value={newTabLabel}
                  onChange={(e) => setNewTabLabel(e.target.value)}
                  placeholder="Takeaway / Walk-in"
                />
              </div>
            ) : null}
            <Button className="w-full" disabled={pending} onClick={createTab}>
              {pending ? "Opening…" : "Open tab"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {successBill ? (
        <InvoiceCreatedDialog
          open={Boolean(successBill)}
          onOpenChange={(open) => {
            if (!open) setSuccessBill(null);
          }}
          billId={successBill.id}
          invoiceNumber={successBill.invoiceNumber}
          total={successBill.total}
          currency={currency}
          locale={locale}
          businessName={businessName}
          customerName={successBill.customerName}
          paymentMethod={successBill.paymentMethod}
        />
      ) : null}
    </div>
  );
}
