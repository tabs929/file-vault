import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API proxy routes and session-clear handler must not be intercepted.
  if (pathname.startsWith("/api/") || pathname === "/auth/clear") {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  // Cookie presence only — JWT verification happens server-side per API request.
  if (!hasSession && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/auth/verify-email",
  ],
};
