import { WhatsAppWebhookSetupCard } from "@/components/settings/whatsapp-webhook-setup-card";
import { PlatformWhatsAppSettingsForm } from "@/components/admin/platform-whatsapp-settings-form";
import { getPlatformWhatsAppSettingsPublic } from "@/app/actions/whatsapp-settings";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { formatCurrency } from "@/lib/currency/format";
import { getWhatsAppWebhookPublicInfo } from "@/lib/whatsapp/webhook-info";
import { format } from "date-fns";
import { MessageCircle } from "lucide-react";

export default async function AdminWhatsAppPage() {
  const { supabase } = await requirePlatformAdmin();
  const webhookInfo = getWhatsAppWebhookPublicInfo();
  const platformSettings = await getPlatformWhatsAppSettingsPublic();

  const [
    { count: total },
    { count: sent },
    { count: delivered },
    { count: failed },
    { data: deliveries },
  ] = await Promise.all([
    supabase
      .from("whatsapp_invoice_deliveries")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("whatsapp_invoice_deliveries")
      .select("*", { count: "exact", head: true })
      .in("status", ["sent", "delivered"]),
    supabase
      .from("whatsapp_invoice_deliveries")
      .select("*", { count: "exact", head: true })
      .eq("status", "delivered"),
    supabase
      .from("whatsapp_invoice_deliveries")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase
      .from("whatsapp_invoice_deliveries")
      .select("*, bills(invoice_number, total)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const tenantIds = [
    ...new Set((deliveries ?? []).map((d) => d.tenant_id as string)),
  ];
  const { data: businesses } = tenantIds.length
    ? await supabase
        .from("businesses")
        .select("id, name, currency, locale")
        .in("id", tenantIds)
    : { data: [] as Array<{ id: string; name: string; currency: string; locale: string }> };

  const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));

  const totalN = total ?? 0;
  const sentN = sent ?? 0;
  const deliveredN = delivered ?? 0;
  const failedN = failed ?? 0;
  const deliveryRate =
    sentN > 0 ? Math.round((deliveredN / sentN) * 1000) / 10 : 0;

  const byTenant = new Map<string, { name: string; count: number }>();
  for (const d of deliveries ?? []) {
    const biz = bizMap.get(d.tenant_id as string);
    const key = d.tenant_id as string;
    const cur = byTenant.get(key) ?? {
      name: biz?.name ?? key.slice(0, 8),
      count: 0,
    };
    cur.count += 1;
    byTenant.set(key, cur);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageCircle className="size-6" />
          WhatsApp Messages
        </h1>
        <p className="text-sm text-muted-foreground">
          All invoices are sent from BillMoney’s WhatsApp Business number.
          Phone numbers are masked.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformWhatsAppSettingsForm settings={platformSettings} />
        <div className="max-w-xl">
          <WhatsAppWebhookSetupCard
            callbackUrl={webhookInfo.callbackUrl}
            verifyTokenConfigured={webhookInfo.verifyTokenConfigured}
            appSecretConfigured={webhookInfo.appSecretConfigured}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total sends", value: String(totalN) },
          { label: "API accepted (sent+)", value: String(sentN) },
          { label: "Delivered", value: String(deliveredN) },
          { label: "Failed", value: String(failedN) },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Delivery rate (delivered ÷ sent+):{" "}
        <span className="font-medium text-foreground">{deliveryRate}%</span>.
        “Sent” means the provider accepted the message — not customer delivery.
      </p>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">By business</h2>
        <ul className="space-y-1 text-sm">
          {[...byTenant.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map((t) => (
              <li key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span className="text-muted-foreground">{t.count}</span>
              </li>
            ))}
          {!byTenant.size ? (
            <li className="text-muted-foreground">No deliveries yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Sent at</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(deliveries ?? []).map((d) => {
              const biz = bizMap.get(d.tenant_id as string);
              const bill = d.bills as {
                invoice_number?: string | null;
                total?: number;
              } | null;
              const phone = String(d.phone_number ?? "");
              const masked =
                phone.length > 6
                  ? `${phone.slice(0, 4)}…${phone.slice(-4)}`
                  : "••••";
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2">{biz?.name ?? "—"}</td>
                  <td className="px-3 py-2">{bill?.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{masked}</td>
                  <td className="px-3 py-2">
                    {bill?.total != null
                      ? formatCurrency(bill.total, {
                          code: biz?.currency ?? "INR",
                          locale: biz?.locale ?? "en-IN",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format(
                      new Date(
                        (d.sent_at as string) || (d.created_at as string)
                      ),
                      "dd MMM yyyy HH:mm"
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize">{String(d.status)}</td>
                </tr>
              );
            })}
            {!deliveries?.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No WhatsApp deliveries recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
