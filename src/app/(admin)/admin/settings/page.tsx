import { TrialDurationForm } from "@/components/admin/trial-duration-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import {
  formatTrialDuration,
  type TrialDurationUnit,
} from "@/lib/subscription/constants";

export default async function AdminSettingsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("trial_duration_value, trial_duration_unit")
    .eq("id", 1)
    .maybeSingle();

  const value = settings?.trial_duration_value ?? 5;
  const unit = (settings?.trial_duration_unit ?? "minutes") as TrialDurationUnit;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide defaults for new app customers.
        </p>
      </div>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Free trial duration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current:{" "}
            <strong className="text-foreground">
              {formatTrialDuration(value, unit)}
            </strong>{" "}
            before customers are asked to pay ₹999/month.
          </p>
          <TrialDurationForm value={value} unit={unit} />
        </CardContent>
      </Card>
    </div>
  );
}
