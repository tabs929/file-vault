import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Vault home">
            <Logo size="md" showWordmark />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </a>
            <a
              href="#security"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Security
            </a>
          </nav>
        </div>

        {/* Right: theme toggle + auth links */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground px-3 py-2"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
