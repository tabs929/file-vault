import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password">
      <p className="text-sm text-muted-foreground">
        Password reset is coming in the next build. For now, please contact
        support if you&apos;re locked out.
      </p>
      <Button asChild className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </AuthCard>
  );
}
