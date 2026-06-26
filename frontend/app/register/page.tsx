"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError } from "@/lib/api";
import { register } from "@/lib/auth";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    full_name: z.string().min(1, "Full name is required").max(100),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    plan_name: z.enum(["free", "pro_10"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const planOptions = [
  { value: "free" as const, name: "Free", description: "100 MB storage" },
  { value: "pro_10" as const, name: "Pro", description: "10 GB storage" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      plan_name: "free",
    },
    // validate on blur so confirmPassword match is only checked when leaving the field,
    // not on every keystroke
    mode: "onBlur",
  });

  const selectedPlan = form.watch("plan_name");
  const passwordValue = useWatch({ control: form.control, name: "password" });
  const meetsLength = passwordValue.length >= 8;

  async function onSubmit(values: RegisterFormValues) {
    setLoading(true);
    setAuthError(null);
    try {
      const { confirmPassword: _cp, ...registerValues } = values;
      await register(registerValues);
      toast.success("Account created — please sign in");
      router.push("/login");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setAuthError("An account with this email already exists.");
        } else if (error.status === 400) {
          setAuthError(error.message || "Invalid request. Please check your details.");
        } else {
          setAuthError(error.message || "Something went wrong. Please try again.");
        }
      } else {
        setAuthError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your vault"
      description="Pick a plan to get started."
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Full name */}
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    disabled={loading}
                    {...field}
                    onChange={(e) => { field.onChange(e); setAuthError(null); }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                {authError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive mb-1">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {authError}
                  </div>
                )}
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    disabled={loading}
                    {...field}
                    onChange={(e) => { field.onChange(e); setAuthError(null); }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password with eye toggle + live rule hint */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
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
                <p
                  className={cn(
                    "text-xs",
                    passwordValue.length === 0
                      ? "text-muted-foreground"
                      : meetsLength
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  )}
                >
                  {meetsLength ? "✓ " : passwordValue.length > 0 ? "× " : ""}
                  At least 8 characters.
                </p>
              </FormItem>
            )}
          />

          {/* Confirm password with eye toggle */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
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

          {/* Plan picker — unchanged */}
          <FormField
            control={form.control}
            name="plan_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plan</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-2"
                    disabled={loading}
                  >
                    {planOptions.map((plan) => (
                      <Label
                        key={plan.value}
                        htmlFor={plan.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors",
                          selectedPlan === plan.value
                            ? "border border-primary"
                            : "border border-border/50"
                        )}
                      >
                        <RadioGroupItem
                          value={plan.value}
                          id={plan.value}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {plan.description}
                          </div>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            By creating an account you agree to our{" "}
            <a href="#" className="text-primary hover:underline">
              Terms of Service
            </a>
            .
          </p>
        </form>
      </Form>
    </AuthCard>
  );
}
