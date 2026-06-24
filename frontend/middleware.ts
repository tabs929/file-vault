import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Route Handler clears invalid sessions — must not be blocked by auth redirects.
  if (pathname === "/auth/clear") {
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
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
