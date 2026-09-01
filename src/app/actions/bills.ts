"use server";

import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { canPriceOverride, requirePermission } from "@/lib/auth/permissions";
import { calculateBill } from "@/lib/billing/calculate";
import { validateDiscountAmount } from "@/lib/billing/discount-limits";
import { getActiveMembership } from "@/lib/auth/session";
import { toMinorUnits } from "@/lib/currency/format";
import { defaultPaymentStatus } from "@/lib/billing/payment-status";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  createBillSchema,
  createOpenTabSchema,
  finalizeDraftBillSchema,
  partialRefundSchema,
  updateDraftBillSchema,
} from "@/lib/validation/schemas";
import type { MemberRole, Product } from "@/types/database";
import { revalidatePath } from "next/cache";

export type BillActionResult = {
  error?: string;
  billId?: string;
  success?: boolean;
  invoiceNumber?: string | null;
  total?: number;
};

async function loadProductsMap(
  supabase: Awaited<ReturnType<typeof getActiveMembership>>["supabase"],
  tenantId: string,
  productIds: string[]
) {
  if (!productIds.length) {
    return { productMap: new Map<string, Product>(), error: undefined as string | undefined };
  }
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", productIds)
    .eq("is_active", true);

  if (error) return { productMap: new Map<string, Product>(), error: error.message };
  if (!products || products.length !== new Set(productIds).size) {
    return {
      productMap: new Map<string, Product>(),
      error: "One or more products are unavailable",
    };
  }
  return {
    productMap: new Map(products.map((p) => [p.id, p as Product])),
    error: undefined,
  };
}

async function validateCustomerId(
  supabase: Awaited<ReturnType<typeof getActiveMembership>>["supabase"],
  tenantId: string,
  customerId: string | null | undefined
) {
  if (!customerId) return undefined;
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Customer not found";
  return undefined;
}

function resolveUnitPrice(
  product: Product,
  item: {
    unit_price_override?: number;
    override_reason?: string;
  },
  role: MemberRole,
  allowCashierOverride: boolean
): { unitPrice: number; priceOverride: boolean; overrideReason: string | null; error?: string } {
  const catalog = product.selling_price;
  if (item.unit_price_override === undefined || item.unit_price_override === catalog / 100) {
    return { unitPrice: catalog, priceOverride: false, overrideReason: null };
  }

  if (!canPriceOverride(role, allowCashierOverride)) {
    return {
      unitPrice: catalog,
      priceOverride: false,
      overrideReason: null,
      error: "You cannot override product prices",
    };
  }

  if (role === "admin" && !item.override_reason?.trim()) {
    return {
      unitPrice: catalog,
      priceOverride: false,
      overrideReason: null,
      error: "Price override requires a reason",
    };
  }

  return {
    unitPrice: toMinorUnits(item.unit_price_override),
    priceOverride: true,
    overrideReason: item.override_reason?.trim() || null,
  };
}

function buildCalcLines(
  items: {
    product_id: string;
    quantity: number;
    line_discount: number;
    unit_price_override?: number;
    override_reason?: string;
  }[],
  productMap: Map<string, Product>,
  role: MemberRole,
  allowCashierOverride: boolean
) {
  const lines: {
    quantity: number;
    unitPrice: number;
    taxRateBps: number;
    lineDiscount: number;
    priceOverride: boolean;
    overrideReason: string | null;
    product: Product;
  }[] = [];

  for (const item of items) {
    const product = productMap.get(item.product_id)!;
    const resolved = resolveUnitPrice(product, item, role, allowCashierOverride);
    if (resolved.error) return { error: resolved.error as string, lines: null };
    lines.push({
      quantity: item.quantity,
      unitPrice: resolved.unitPrice,
      taxRateBps: product.tax_rate_bps,
      lineDiscount: toMinorUnits(item.line_discount),
      priceOverride: resolved.priceOverride,
      overrideReason: resolved.overrideReason,
      product,
    });
  }

  return { lines, error: undefined as string | undefined };
}

function revalidateBillPaths(billId?: string) {
  revalidatePath("/bills");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/billing");
  revalidatePath("/admin");
  if (billId) revalidatePath(`/bills/${billId}`);
}

export async function createBillAction(input: unknown): Promise<BillActionResult> {
  const parsed = createBillSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };
  }

  const { supabase, tenantId, user, business, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:create");
  if (!perm.ok) return { error: perm.error };

  const rate = checkRateLimit(`finalize:${tenantId}:${user.id}`);
  if (!rate.ok) return { error: rate.error };

  const customerError = await validateCustomerId(
    supabase,
    tenantId,
    parsed.data.customer_id
  );
  if (customerError) return { error: customerError };

  const productIds = parsed.data.items.map((i) => i.product_id);
  const { productMap, error: productsError } = await loadProductsMap(
    supabase,
    tenantId,
    productIds
  );
  if (productsError) return { error: productsError };

  const built = buildCalcLines(
    parsed.data.items,
    productMap,
    role,
    business.allow_cashier_price_override ?? false
  );
  if (built.error || !built.lines) return { error: built.error ?? "Invalid items" };

  const billDiscountMinor = toMinorUnits(parsed.data.bill_discount);
  const calc = calculateBill({
    taxEnabled: business.tax_enabled,
    billDiscount: billDiscountMinor,
    lines: built.lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRateBps: l.taxRateBps,
      lineDiscount: l.lineDiscount,
    })),
  });

  const discountCheck = validateDiscountAmount(role, calc.subtotal, calc.discount);
  if (!discountCheck.ok) return { error: discountCheck.error };

  const paymentStatus =
    parsed.data.payment_status ??
    defaultPaymentStatus(parsed.data.payment_method);

  const rpcItems = parsed.data.items.map((item, index) => {
    const line = built.lines![index]!;
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      line_discount: line.lineDiscount,
      unit_price: line.unitPrice,
      price_override: line.priceOverride,
      override_reason: line.overrideReason,
    };
  });

  const idempotencyKey =
    parsed.data.idempotency_key ?? crypto.randomUUID();

  const { data, error } = await supabase.rpc("create_and_finalize_bill", {
    p_customer_id: parsed.data.customer_id || null,
    p_bill_discount: billDiscountMinor,
    p_payment_method: parsed.data.payment_method || "cash",
    p_payment_status: paymentStatus,
    p_notes: parsed.data.notes || null,
    p_items: rpcItems,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("create_and_finalize_bill failed", error.message);
    return { error: "Could not create invoice. Please try again." };
  }

  const result = data as {
    bill_id: string;
    invoice_number: string;
    total: number;
  };

  for (const line of built.lines) {
    if (line.priceOverride) {
      await writeAuditLog(supabase, {
        tenantId,
        action: "PRICE_OVERRIDE_APPLIED",
        entityType: "bill_item",
        entityId: result.bill_id,
        metadata: {
          product_id: line.product.id,
          catalog_price: line.product.selling_price,
          final_price: line.unitPrice,
          reason: line.overrideReason,
          user_id: user.id,
        },
      });
    }
  }

  revalidateBillPaths(result.bill_id);
  return {
    billId: result.bill_id,
    invoiceNumber: result.invoice_number,
    total: result.total,
  };
}

export async function createOpenTabAction(input: unknown): Promise<BillActionResult> {
  const parsed = createOpenTabSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tab" };
  }

  const { supabase, tenantId, user, business, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:create");
  if (!perm.ok) return { error: perm.error };

  if (!business.open_tabs_enabled) {
    return { error: "Restaurant / open tabs mode is not enabled" };
  }

  let tabLabel = parsed.data.tab_label?.trim() || null;
  const tableId = parsed.data.table_id || null;

  if (tableId) {
    const { data: table, error } = await supabase
      .from("dining_tables")
      .select("*")
      .eq("id", tableId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !table) return { error: error?.message ?? "Table not found" };
    tabLabel = table.name;

    const { data: existing } = await supabase
      .from("bills")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("table_id", tableId)
      .eq("status", "draft")
      .maybeSingle();
    if (existing) return { billId: existing.id };
  }

  const customerError = await validateCustomerId(
    supabase,
    tenantId,
    parsed.data.customer_id
  );
  if (customerError) return { error: customerError };

  const { data: bill, error } = await supabase
    .from("bills")
    .insert({
      tenant_id: tenantId,
      invoice_number: null,
      customer_id: parsed.data.customer_id || null,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      status: "draft",
      payment_method: null,
      payment_status: "pending",
      notes: null,
      tab_label: tabLabel,
      table_id: tableId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !bill) {
    return { error: error?.message ?? "Failed to open tab" };
  }

  revalidatePath("/billing");
  return { billId: bill.id };
}

export async function updateDraftBillAction(input: unknown): Promise<BillActionResult> {
  const parsed = updateDraftBillSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid draft" };
  }

  const { supabase, tenantId, business, role, user } = await getActiveMembership();
  const perm = requirePermission(role, "bill:create");
  if (!perm.ok) return { error: perm.error };

  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("id, status")
    .eq("id", parsed.data.bill_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (billError || !bill) return { error: billError?.message ?? "Bill not found" };
  if (bill.status !== "draft") return { error: "Only open tabs can be edited" };

  const customerError = await validateCustomerId(
    supabase,
    tenantId,
    parsed.data.customer_id
  );
  if (customerError) return { error: customerError };

  const productIds = parsed.data.items.map((i) => i.product_id);
  const { productMap, error: productsError } = await loadProductsMap(
    supabase,
    tenantId,
    productIds
  );
  if (productsError) return { error: productsError };

  const built = buildCalcLines(
    parsed.data.items,
    productMap,
    role,
    business.allow_cashier_price_override ?? false
  );
  if (built.error || !built.lines) return { error: built.error ?? "Invalid items" };

  const billDiscountMinor = toMinorUnits(parsed.data.bill_discount);
  const calc = calculateBill({
    taxEnabled: business.tax_enabled,
    billDiscount: billDiscountMinor,
    lines: built.lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRateBps: l.taxRateBps,
      lineDiscount: l.lineDiscount,
    })),
  });

  const discountCheck = validateDiscountAmount(role, calc.subtotal, calc.discount);
  if (!discountCheck.ok) return { error: discountCheck.error };

  const paymentStatus =
    parsed.data.payment_status ??
    defaultPaymentStatus(parsed.data.payment_method);

  const { error: updateError } = await supabase
    .from("bills")
    .update({
      customer_id: parsed.data.customer_id || null,
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax: calc.tax,
      total: calc.total,
      payment_method: parsed.data.payment_method || null,
      payment_status: paymentStatus,
      notes: parsed.data.notes || null,
    })
    .eq("id", bill.id)
    .eq("tenant_id", tenantId)
    .eq("status", "draft");

  if (updateError) return { error: updateError.message };

  const { error: deleteError } = await supabase
    .from("bill_items")
    .delete()
    .eq("bill_id", bill.id)
    .eq("tenant_id", tenantId);

  if (deleteError) return { error: deleteError.message };

  if (parsed.data.items.length) {
    const itemsPayload = built.lines.map((line, index) => {
      const itemCalc = calc.lines[index]!;
      return {
        tenant_id: tenantId,
        bill_id: bill.id,
        product_id: line.product.id,
        product_name: line.product.name,
        sku: line.product.sku,
        quantity: parsed.data.items[index]!.quantity,
        unit_price: line.unitPrice,
        catalog_unit_price: line.product.selling_price,
        tax_rate_bps: line.product.tax_rate_bps,
        discount: itemCalc.lineDiscount,
        line_total: itemCalc.lineNet,
        price_override: line.priceOverride,
        override_reason: line.overrideReason,
        overridden_by: line.priceOverride ? user.id : null,
      };
    });
    const { error: itemsError } = await supabase.from("bill_items").insert(itemsPayload);
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/billing");
  return { billId: bill.id, success: true };
}

export async function finalizeDraftBillAction(
  input: unknown
): Promise<BillActionResult> {
  const parsed = finalizeDraftBillSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };
  }

  const updateResult = await updateDraftBillAction(parsed.data);
  if (updateResult.error) return updateResult;

  const { supabase, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:create");
  if (!perm.ok) return { error: perm.error };

  const paymentStatus =
    parsed.data.payment_status ??
    defaultPaymentStatus(parsed.data.payment_method);

  const idempotencyKey =
    parsed.data.idempotency_key ?? crypto.randomUUID();

  const { data, error } = await supabase.rpc("finalize_bill", {
    p_bill_id: parsed.data.bill_id,
    p_payment_method: parsed.data.payment_method || "cash",
    p_payment_status: paymentStatus,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("finalize_bill failed", error.message);
    return { error: "Could not finalize invoice. Please try again." };
  }

  const result = data as {
    bill_id: string;
    invoice_number: string;
    total: number;
  };

  revalidateBillPaths(result.bill_id);
  return {
    billId: result.bill_id,
    invoiceNumber: result.invoice_number,
    total: result.total,
  };
}

export async function cancelBillAction(billId: string) {
  const { supabase, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:cancel");
  if (!perm.ok) return { error: perm.error };

  const { error } = await supabase.rpc("cancel_bill_with_fee_reversal", {
    p_bill_id: billId,
  });

  if (error) {
    console.error("cancel bill failed", error.message);
    return { error: "Could not cancel invoice." };
  }
  revalidateBillPaths(billId);
  revalidatePath("/admin/revenue");
  return { success: true };
}

export async function recordPartialRefundAction(input: unknown) {
  const parsed = partialRefundSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid refund" };
  }

  const { supabase, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:refund");
  if (!perm.ok) return { error: perm.error };

  const { error } = await supabase.rpc("record_partial_refund", {
    p_bill_id: parsed.data.bill_id,
    p_amount: toMinorUnits(parsed.data.amount),
    p_reason: parsed.data.reason,
  });

  if (error) {
    console.error("partial refund failed", error.message);
    return { error: "Could not record refund." };
  }

  revalidateBillPaths(parsed.data.bill_id);
  revalidatePath("/admin/revenue");
  return { success: true };
}

export async function updatePaymentStatusAction(
  billId: string,
  paymentStatus: "pending" | "paid"
) {
  const { supabase, tenantId, role } = await getActiveMembership();

  if (paymentStatus === "paid" && role === "staff") {
    const { data: bill } = await supabase
      .from("bills")
      .select("payment_method")
      .eq("id", billId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (bill?.payment_method === "upi" || bill?.payment_method === "bank_transfer") {
      return { error: "Cashiers cannot mark UPI/bank payments as received" };
    }
  }

  const { error } = await supabase
    .from("bills")
    .update({ payment_status: paymentStatus })
    .eq("id", billId)
    .eq("tenant_id", tenantId)
    .eq("status", "paid");

  if (error) return { error: error.message };

  await writeAuditLog(supabase, {
    tenantId,
    action: "PAYMENT_STATUS_CHANGED",
    entityType: "bill",
    entityId: billId,
    metadata: { payment_status: paymentStatus },
  });

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

export async function duplicateBillAction(billId: string): Promise<BillActionResult> {
  const { supabase, tenantId, role } = await getActiveMembership();
  const perm = requirePermission(role, "bill:create");
  if (!perm.ok) return { error: perm.error };

  const { data: bill, error } = await supabase
    .from("bills")
    .select("*, bill_items(*)")
    .eq("id", billId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !bill) return { error: error?.message ?? "Bill not found" };

  const items = (bill.bill_items ?? []).filter(
    (item: { product_id: string | null }) => item.product_id
  );

  if (!items.length) {
    return { error: "No active products to duplicate from this invoice" };
  }

  return createBillAction({
    customer_id: bill.customer_id,
    bill_discount: bill.discount / 100,
    payment_method: bill.payment_method,
    payment_status: defaultPaymentStatus(bill.payment_method),
    notes: bill.notes,
    items: items.map(
      (item: { product_id: string; quantity: number; discount: number }) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        line_discount: item.discount / 100,
      })
    ),
    idempotency_key: crypto.randomUUID(),
  });
}
