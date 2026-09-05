"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency/format";
import type { Bill } from "@/types/database";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type BillRow = Bill & {
  customers?: { name: string } | null;
};

export function BillsTable({
  bills,
  currency,
  locale,
  page,
  totalPages,
}: {
  bills: BillRow[];
  currency: string;
  locale: string;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    if (!("page" in updates)) params.delete("page");
    startTransition(() => {
      router.push(`/bills?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            pushParams({ q });
          }}
        >
          <Input
            placeholder="Search invoice #…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Search
          </Button>
        </form>
        <Input
          type="date"
          className="sm:w-40"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => pushParams({ from: e.target.value })}
        />
        <Input
          type="date"
          className="sm:w-40"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => pushParams({ to: e.target.value })}
        />
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Customer
              </th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Payment
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/bills/${bill.id}`}
                    className="font-medium hover:underline"
                  >
                    {bill.invoice_number ||
                      (bill.tab_label
                        ? `Open · ${bill.tab_label}`
                        : "Open tab")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(bill.created_at), "dd MMM yyyy")}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {bill.customers?.name || "Walk-in"}
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(bill.total, { code: currency, locale })}
                </td>
                <td className="hidden px-4 py-3 capitalize text-muted-foreground md:table-cell">
                  {bill.payment_method?.replace("_", " ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      bill.status === "paid"
                        ? "default"
                        : bill.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {bill.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Link
                      href={`/bills/${bill.id}`}
                      className="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-muted"
                    >
                      View
                    </Link>
                    <Link
                      href={`/bills/${bill.id}/print`}
                      target="_blank"
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted"
                    >
                      <Printer className="size-3.5" />
                      Print
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!bills.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No invoices found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={page <= 1 || pending}
            onClick={() => pushParams({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages || pending}
            onClick={() => pushParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
