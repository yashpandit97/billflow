import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const authError =
    params.error === "google-disabled"
      ? "Google sign-in is not enabled on this Supabase project."
      : params.error === "auth"
        ? "Google sign-in failed. Please try again or use email."
        : undefined;

  return (
    <AuthShell
      title="Create your account"
      description="Start billing in minutes. Free trial included, then ₹999/month for your whole team."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm authError={authError} />
    </AuthShell>
  );
}
