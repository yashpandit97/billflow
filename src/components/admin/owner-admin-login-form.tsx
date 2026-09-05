"use client";

import { ownerAdminLoginAction } from "@/app/actions/owner-admin";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

export function OwnerAdminLoginForm() {
  const [state, action] = useActionState(ownerAdminLoginAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="admin"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <SubmitButton className="w-full">Sign in to admin</SubmitButton>
    </form>
  );
}
