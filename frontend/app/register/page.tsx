"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
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

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  plan_name: z.enum(["free", "pro_10"]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const planOptions = [
  {
    value: "free" as const,
    name: "Free",
    description: "100 MB storage",
  },
  {
    value: "pro_10" as const,
    name: "Pro",
    description: "10 GB storage",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      plan_name: "free",
    },
  });

  const selectedPlan = form.watch("plan_name");

  async function onSubmit(values: RegisterFormValues) {
    setLoading(true);
    try {
      await register(values);
      toast.success("Account created — please sign in");
      router.push("/login");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast.error("Registration failed");
        } else if (error.status === 400) {
          toast.error(error.message);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Something went wrong. Please try again.");
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
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </form>
      </Form>
    </AuthCard>
  );
}
