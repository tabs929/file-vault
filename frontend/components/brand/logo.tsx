import * as React from "react";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
}

const sizeMap: Record<
  LogoSize,
  { square: number; icon: number; wordmark: string }
> = {
  // sm: tight spaces, favicons
  sm: { square: 20, icon: 12, wordmark: "text-[13px] font-medium" },
  // md: nav, header, footer (default)
  md: { square: 28, icon: 16, wordmark: "text-[16px] font-medium" },
  // lg: hero, auth pages
  lg: { square: 32, icon: 18, wordmark: "text-[18px] font-medium" },
};

export function Logo({
  size = "md",
  showWordmark = true,
  className,
}: LogoProps) {
  const { square, icon, wordmark } = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Indigo rounded square mark */}
      <div
        className="flex shrink-0 items-center justify-center rounded-lg bg-primary"
        style={{ width: square, height: square }}
      >
        {/* V-lock SVG: stylized V with centered lock-dot */}
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 4 L12 20 L20 4"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13" r="2.2" fill="white" />
        </svg>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <span className={cn("text-foreground tracking-tight", wordmark)}>
          Vault
        </span>
      )}
    </div>
  );
}
