import { CustomersManager } from "@/components/customers/customers-manager";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveMembership } from "@/lib/auth/session";
import { Users } from "lucide-react";

export default async function CustomersPage() {
  const { supabase, tenantId } = await getActiveMembership();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Optional — save customer names and WhatsApp numbers for faster billing.
        </p>
      </div>

      {!customers?.length ? (
        <div className="space-y-4">
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add a customer when you want to save their number for WhatsApp invoices. Walk-ins work without this."
          />
          <CustomersManager customers={[]} />
        </div>
      ) : (
        <CustomersManager customers={customers} />
      )}
    </div>
  );
}
