import * as React from "react";
import { Logo } from "@/components/brand/logo";

const productLinks = [
  { label: "Features", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Security", href: "#" },
];

const resourceLinks = [
  { label: "Docs", href: "#" },
  { label: "API", href: "#" },
  { label: "Status", href: "#" },
];

const legalLinks = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
];

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 pt-12 pb-6">
        {/* Four-column grid */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Column 1: logo + tagline */}
          <div className="space-y-4">
            <Logo size="md" showWordmark />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              Secure file storage built with Next.js, FastAPI, and S3.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Product</p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Resources</p>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Legal</p>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Vault. Built as a take-home assessment.
          </p>
        </div>
      </div>
    </footer>
  );
}
