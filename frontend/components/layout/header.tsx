import Link from "next/link";

import { HeaderBackground } from "@/components/layout/header-background";
import { HeaderLogo } from "@/components/layout/header-logo";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth-server";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="relative sticky top-0 z-50 w-full">
      <HeaderBackground />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <HeaderLogo />

          {!user ? (
            <nav className="hidden items-center gap-6 md:flex">
              <a
                href="/#features"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Features
              </a>
              <a
                href="/#pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </a>
              <a
                href="/#security"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Security
              </a>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <HeaderUserMenu fullName={user.full_name ?? ''} email={user.email} />
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
