import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

function googleAuthError(error?: string) {
  if (error === "google-disabled") {
    return "Google sign-in is not enabled on this Supabase project.";
  }
  if (error === "auth") {
    return "Google sign-in failed. Please try again or use email.";
  }
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const authError = googleAuthError(params.error);

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your BillMoney account."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm next={params.next} authError={authError} />
    </AuthShell>
  );
}
