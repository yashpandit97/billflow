"use client";

import { forgotPasswordAction, type ActionResult } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: ActionResult = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="rounded-md bg-success/15 px-3 py-2 text-sm text-success">
          {state.success}
        </p>
      ) : null}
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
