"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { verifyEmail } from "@/lib/auth";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<Status>("loading");

  React.useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  if (status === "loading") {
    return (
      <AuthCard title="Verifying your email">
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard
        title="Email verified"
        footer={
          <Link href="/dashboard" className="text-primary hover:underline">
            Go to your vault
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground text-center">
            Your email has been verified. You can now upload files.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verification failed"
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground text-center">
          This link is invalid or has expired. Request a new one from your
          dashboard.
        </p>
      </div>
    </AuthCard>
  );
}

const LoadingFallback = (
  <AuthCard title="Verifying your email">
    <div className="flex justify-center py-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  </AuthCard>
);

export default function VerifyEmailPage() {
  return <Suspense fallback={LoadingFallback}><VerifyEmailContent /></Suspense>;
}
