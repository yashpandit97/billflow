"use client";

import { signUpAction, type ActionResult } from "@/app/actions/auth";
import {
  AuthMethodDivider,
  GoogleAuthButton,
} from "@/components/auth/google-auth-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: ActionResult = {};

export function SignupForm({ authError }: { authError?: string }) {
  const [state, formAction] = useActionState(signUpAction, initial);

  return (
    <div className="space-y-4">
      {authError ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {authError}
        </p>
      ) : null}
      <GoogleAuthButton next="/onboarding" label="Continue with Google" />
      <AuthMethodDivider />
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        {state.error ? (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <SubmitButton className="w-full">Create account</SubmitButton>
      </form>
    </div>
  );
}
