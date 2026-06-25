"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Suspense } from "react";
import { z } from "zod";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { resetPassword, verifyResetToken } from "@/lib/auth";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

type PageStatus = "checking" | "ready" | "invalid" | "done";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = React.useState<PageStatus>("checking");
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    verifyResetToken(token)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await resetPassword(token, values.password);
      setStatus("done");
    } catch {
      form.setError("root", {
        message: "Invalid or expired link. Please request a new one.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (status === "checking") {
    return (
      <AuthCard title="Reset your password">
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard
        title="Link expired"
        footer={
          <Link href="/forgot-password" className="text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground text-center">
            This password reset link is invalid or has expired.
          </p>
        </div>
      </AuthCard>
    );
  }

  if (status === "done") {
    return (
      <AuthCard
        title="Password updated"
        footer={
          <Link href="/login" className="text-primary hover:underline">
            Sign in with your new password
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Your password has been reset. All existing sessions have been signed
          out.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {form.formState.errors.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={loading}
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={loading}
                      {...field}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}

const CheckingFallback = (
  <AuthCard title="Reset your password">
    <div className="flex justify-center py-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  </AuthCard>
);

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={CheckingFallback}>
      <ResetPasswordContent />
    </Suspense>
  );
}
