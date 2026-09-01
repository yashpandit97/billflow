"use client";

import {
  upsertCustomerAction,
  type CustomerActionResult,
} from "@/app/actions/customers";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/types/database";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const initial: CustomerActionResult = {};

function CustomerForm({
  customer,
  onDone,
}: {
  customer?: Customer;
  onDone?: (id?: string) => void;
}) {
  const [state, formAction] = useActionState(upsertCustomerAction, initial);

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      onDone?.(state.customerId);
    }
    if (state.error) toast.error(state.error);
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={customer?.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp / Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+91XXXXXXXXXX"
            defaultValue={customer?.phone ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Use international format when possible (e.g. +91…).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={customer?.address ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tax_id">GSTIN / Tax ID</Label>
        <Input id="tax_id" name="tax_id" defaultValue={customer?.tax_id ?? ""} />
      </div>
      <SubmitButton className="w-full">
        {customer ? "Save changes" : "Add customer"}
      </SubmitButton>
    </form>
  );
}

export function CustomersManager({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();

  const filtered = useMemo(() => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name, phone, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add customer
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
            </DialogHeader>
            <CustomerForm
              customer={editing}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Phone</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Email</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="hover:underline"
                  >
                    {customer.name}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {customer.phone || "—"}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {customer.email || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(customer);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { CustomerForm };
