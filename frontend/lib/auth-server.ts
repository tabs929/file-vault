import { cookies } from "next/headers";

import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/auth";

export const SESSION_COOKIE = "session";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) {
    return null;
  }

  try {
    return await apiFetch<User>("/auth/me", {
      serverCookies: `${SESSION_COOKIE}=${session.value}`,
    });
  } catch (error) {
    // 401 = no valid session — expected for logged-out or expired cookies.
    // fetch failed = API unreachable (e.g. still starting) — treat as logged out.
    // Other API errors are logged but still return null so RSC render never throws.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    if (error instanceof TypeError && error.message === "fetch failed") {
      return null;
    }
    console.error("getCurrentUser failed:", error);
    return null;
  }
}
