import { apiFetch } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  plan_name: string;
  quota_bytes: number;
  used_bytes: number;
  email_verified: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  plan_name: "free" | "pro_10";
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
