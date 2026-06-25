import { apiFetch } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  plan_name: string;
  quota_bytes: number;
  used_bytes: number;
  email_verified: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  plan_name: "free" | "pro_10";
  full_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<User> {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<User> {
  return apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}

export async function resendVerification(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
  });
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`
  );
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyResetToken(token: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/auth/verify-reset-token?token=${encodeURIComponent(token)}`
  );
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
