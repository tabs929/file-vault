import Link from "next/link";
import {
  FileText,
  FileImage,
  FileArchive,
  Lock,
  Zap,
  Gauge,
  Folder,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Static fake file data for product preview mockup ──────────────────────────
const mockFiles = [
  { name: "project-brief.pdf", size: "1.2 MB", Icon: FileText },
  { name: "banner-final.png", size: "3.8 MB", Icon: FileImage },
  { name: "archive-2025.zip", size: "47 MB", Icon: FileArchive },
];

const features = [
  {
    Icon: Lock,
    title: "Private by default",
    body: "Every file scoped to one account. No public links unless you make them.",
  },
  {
    Icon: Zap,
    title: "Direct to storage",
    body: "Uploads stream to S3 with signed URLs. No middleman, no bottleneck.",
  },
  {
    Icon: Gauge,
    title: "Real quotas",
    body: "Storage limits enforced atomically. No surprise overages.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          {/* Pill badge */}
          <div className="mb-6 flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(142_71%_45%)]" />
            <span className="text-xs text-muted-foreground">
              End-to-end encrypted storage
            </span>
          </div>

          <h1 className="text-5xl font-medium tracking-tight text-foreground md:text-6xl">
            Your files, locked down.
          </h1>

          <p className="mt-6 max-w-[480px] text-lg text-muted-foreground">
            Private, fast, and built on infrastructure you can trust. No
            third-party access — ever.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/register">Get started free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        {/* ── Product preview mockup ────────────────────────────────────────── */}
        <section className="mx-auto max-w-2xl px-6 pb-24">
          <Card className="overflow-hidden border-border">
            <CardContent className="p-0">
              {/* Mockup header bar */}
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Folder className="h-4 w-4 text-primary" />
                  Your files
                </div>
                <span className="text-xs text-muted-foreground">
                  3 of 4.2 GB used
                </span>
              </div>

              {/* Storage progress bar */}
              <div className="px-5 pt-4 pb-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: "71%" }}
                  />
                </div>
              </div>

              {/* File rows */}
              <ul className="divide-y divide-border">
                {mockFiles.map(({ name, size, Icon }) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 truncate text-foreground">
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">{size}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-6 pb-24 scroll-mt-20"
        >
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-medium tracking-tight text-foreground">
              Built for what matters.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three things we refused to compromise on.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {features.map(({ Icon, title, body }) => (
              <Card key={title} className="border-border">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── CTA strip ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Card className="border-border bg-card text-center">
            <CardContent className="py-16">
              <h2 className="text-3xl font-medium tracking-tight text-foreground">
                Start storing in 30 seconds.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Free plan, no card required.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/register">Create your vault</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
