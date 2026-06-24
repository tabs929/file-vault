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
    // Other errors (network, 500) are logged but still treated as unauthenticated
    // so pages can redirect cleanly instead of throwing during RSC render.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    console.error("getCurrentUser failed:", error);
    return null;
  }
}
