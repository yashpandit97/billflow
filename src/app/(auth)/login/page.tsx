import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Billflow account."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm next={params.next} />
    </AuthShell>
  );
}
