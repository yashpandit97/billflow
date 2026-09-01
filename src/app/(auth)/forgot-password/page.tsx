import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="We'll email you a link to reset your password."
      footer={
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
