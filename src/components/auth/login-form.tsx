"use client";

import { loginAction, type ActionResult } from "@/app/actions/auth";
import {
  AuthMethodDivider,
  GoogleAuthButton,
} from "@/components/auth/google-auth-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useActionState } from "react";

const initial: ActionResult = {};

export function LoginForm({
  next,
  authError,
}: {
  next?: string;
  authError?: string;
}) {
  const [state, formAction] = useActionState(loginAction, initial);

  return (
    <div className="space-y-4">
      {authError ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {authError}
        </p>
      ) : null}
      <GoogleAuthButton next={next} />
      <AuthMethodDivider />
      <form action={formAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error ? (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </form>
    </div>
  );
}
