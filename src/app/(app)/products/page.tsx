import { ProductsManager } from "@/components/products/products-manager";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveMembership } from "@/lib/auth/session";
import { Package } from "lucide-react";

export default async function ProductsPage() {
  const { supabase, tenantId, business } = await getActiveMembership();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name"),
    supabase.from("categories").select("*").eq("tenant_id", tenantId).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Add items you sell so you can tap them when creating a bill.
        </p>
      </div>

      {!products?.length ? (
        <div className="space-y-4">
          <EmptyState
            icon={Package}
            title="Add your first product"
            description="Examples: Masala dosa, Haircut, Repair service. You can change prices anytime."
          />
          <ProductsManager
            products={[]}
            categories={categories ?? []}
            currency={business.currency}
            locale={business.locale}
            defaultTaxPercent={business.default_tax_rate_bps / 100}
          />
        </div>
      ) : (
        <ProductsManager
          products={products}
          categories={categories ?? []}
          currency={business.currency}
          locale={business.locale}
          defaultTaxPercent={business.default_tax_rate_bps / 100}
        />
      )}
    </div>
  );
}
