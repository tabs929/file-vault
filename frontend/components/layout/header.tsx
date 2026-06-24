import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { HeaderLogoutButton } from "@/components/layout/header-logout-button";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth-server";

export async function Header() {
  const user = await getCurrentUser();
  const avatarInitial = (user?.email[0] ?? "?").toUpperCase();

  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href={user ? "/dashboard" : "/"} aria-label="Vault home">
            <Logo size="md" showWordmark />
          </Link>

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
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
                aria-hidden
              >
                {avatarInitial}
              </div>
              <HeaderLogoutButton />
            </>
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
