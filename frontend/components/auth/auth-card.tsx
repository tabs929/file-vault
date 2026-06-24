import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <Link href="/" className="mb-8" aria-label="Vault home">
        <Logo size="lg" showWordmark />
      </Link>

      <Card className="w-full max-w-[380px] border-border">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="px-6 pb-6 pt-0 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
