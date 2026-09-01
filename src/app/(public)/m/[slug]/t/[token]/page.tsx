import { getPublicMenuAction } from "@/app/actions/public-menu";
import { GuestMenuClient } from "@/components/menu/guest-menu-client";

export const dynamic = "force-dynamic";

export default async function PublicTableMenuPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const result = await getPublicMenuAction(slug, token);

  if (result.error || !result.data) {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-xl font-semibold">Menu unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This QR link is invalid, expired, or restaurant mode is turned off.
        </p>
      </div>
    );
  }

  const { business, table, products } = result.data;

  return (
    <GuestMenuClient
      slug={slug}
      token={token}
      business={business}
      tableName={table.name}
      products={products}
    />
  );
}
