"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { resendVerification } from "@/lib/auth";

export function VerificationBanner() {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function handleResend() {
    setLoading(true);
    try {
      await resendVerification();
      toast.success("Verification email sent. Check your inbox.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        toast.error("Please wait a minute before requesting another email.");
      } else {
        toast.error("Could not send email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm text-amber-800 dark:text-amber-300">
          Please verify your email address to unlock file uploads.{" "}
          <button
            onClick={handleResend}
            disabled={loading}
            className="underline hover:no-underline disabled:opacity-50"
          >
            {loading ? "Sending…" : "Resend verification email"}
          </button>
        </span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDescription>
    </Alert>
  );
}
