"use client";

import {
  createDiningTableAction,
  deactivateDiningTableAction,
  regenerateTableQrTokenAction,
} from "@/app/actions/tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiningTable } from "@/types/database";
import { Copy, QrCode, RefreshCw, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

function tableMenuUrl(slug: string, token: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/m/${slug}/t/${token}`;
}

function TableQrCard({
  table,
  slug,
  onChanged,
}: {
  table: DiningTable;
  slug: string;
  onChanged: (update?: { table?: DiningTable; removed?: boolean }) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const url = useMemo(
    () => tableMenuUrl(slug, table.qr_token),
    [slug, table.qr_token]
  );

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 220,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start gap-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR for ${table.name}`}
            className="h-36 w-36 rounded-lg border border-border bg-white p-1"
          />
        ) : (
          <div className="flex h-36 w-36 items-center justify-center rounded-lg border bg-muted">
            <QrCode className="size-8 opacity-40" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium">{table.name}</p>
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }}
            >
              <Copy className="size-3.5" />
              Copy link
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await regenerateTableQrTokenAction(table.id);
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success(res.success);
                    onChanged({ table: res.table });
                  }
                });
              }}
            >
              <RefreshCw className="size-3.5" />
              New QR
            </Button>
            <Button
              size="sm"
              variant="destructive"
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await deactivateDiningTableAction(table.id);
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success(res.success);
                    onChanged({ removed: true });
                  }
                });
              }}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function TablesSettings({
  slug,
  initialTables,
  openTabsEnabled,
}: {
  slug: string;
  initialTables: DiningTable[];
  openTabsEnabled: boolean;
}) {
  const [name, setName] = useState("");
  const [createdTables, setCreatedTables] = useState<DiningTable[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const tables = useMemo(() => {
    const removed = new Set(removedIds);
    const map = new Map<string, DiningTable>();
    for (const t of initialTables) {
      if (!removed.has(t.id)) map.set(t.id, t);
    }
    for (const t of createdTables) {
      if (!removed.has(t.id)) map.set(t.id, t);
    }
    return [...map.values()].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
  }, [initialTables, createdTables, removedIds]);

  if (!openTabsEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Enable <span className="font-medium">Restaurant / open tabs mode</span>{" "}
        under Invoice settings to manage tables and QR menu links.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Dining tables</h3>
        <p className="text-sm text-muted-foreground">
          Each table gets a unique QR. Guests scan it to open your menu and add
          items to that table&apos;s open bill — no login required.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          startTransition(async () => {
            const res = await createDiningTableAction({
              name: name.trim(),
              sort_order: tables.length,
            });
            if (res.error) toast.error(res.error);
            else if (res.table) {
              toast.success(res.success);
              setCreatedTables((prev) => [...prev, res.table!]);
              setName("");
            }
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="table_name">Table name</Label>
          <Input
            id="table_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table 5"
            className="w-48"
          />
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          Add table
        </Button>
      </form>

      {!tables.length ? (
        <p className="text-sm text-muted-foreground">No tables yet.</p>
      ) : (
        <ul className="space-y-3">
          {tables.map((table) => (
            <TableQrCard
              key={`${table.id}-${table.qr_token}`}
              table={table}
              slug={slug}
              onChanged={(updated) => {
                if (updated?.removed) {
                  setRemovedIds((prev) => [...prev, table.id]);
                  return;
                }
                if (updated?.table) {
                  setCreatedTables((prev) => {
                    const without = prev.filter((t) => t.id !== updated.table!.id);
                    return [...without, updated.table!];
                  });
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
