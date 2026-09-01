import { BillingPos } from "@/components/billing/billing-pos";
import { getActiveMembership } from "@/lib/auth/session";
import type { Bill, BillItem } from "@/types/database";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { supabase, tenantId, business } = await getActiveMembership();

  const [{ data: products }, { data: customers }, { data: openTabs }, { data: tables }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name")
        .limit(200),
      supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name")
        .limit(200),
      business.open_tabs_enabled
        ? supabase
            .from("bills")
            .select("*, bill_items(*)")
            .eq("tenant_id", tenantId)
            .eq("status", "draft")
            .order("updated_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as (Bill & { bill_items?: BillItem[] })[] }),
      business.open_tabs_enabled
        ? supabase
            .from("dining_tables")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("sort_order")
            .order("name")
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <BillingPos
      businessName={business.name}
      initialProducts={products ?? []}
      customers={customers ?? []}
      currency={business.currency}
      locale={business.locale}
      taxEnabled={business.tax_enabled}
      defaultTaxPercent={business.default_tax_rate_bps / 100}
      openTabsEnabled={business.open_tabs_enabled}
      initialOpenTabs={(openTabs as (Bill & { bill_items?: BillItem[] })[]) ?? []}
      tables={tables ?? []}
      initialTabId={tab ?? null}
    />
  );
}
