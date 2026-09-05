"use client";

import { updateTrialDurationAction } from "@/app/actions/platform-settings";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrialDurationUnit } from "@/lib/subscription/constants";
import { useActionState } from "react";

export function TrialDurationForm({
  value,
  unit,
}: {
  value: number;
  unit: TrialDurationUnit;
}) {
  const [state, action] = useActionState(updateTrialDurationAction, {});

  return (
    <form action={action} className="max-w-md space-y-4">
      {state.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          {state.success}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trial_duration_value">Duration</Label>
          <Input
            id="trial_duration_value"
            name="trial_duration_value"
            type="number"
            min={1}
            max={3650}
            defaultValue={value}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trial_duration_unit">Unit</Label>
          <select
            id="trial_duration_unit"
            name="trial_duration_unit"
            defaultValue={unit}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        New businesses get this free trial. Existing trials are not changed.
        Use 5 minutes while testing; set 30 days when ready for production.
      </p>
      <SubmitButton>Save trial duration</SubmitButton>
    </form>
  );
}
