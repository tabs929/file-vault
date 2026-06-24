"use client";

import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";

interface UsageBarProps {
  usedBytes: number;
  quotaBytes: number;
}

export function UsageBar({ usedBytes, quotaBytes }: UsageBarProps) {
  const percent =
    quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const isNearFull = percent >= 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Storage used</span>
        <span className={isNearFull ? "text-destructive font-medium" : "text-muted-foreground"}>
          {formatBytes(usedBytes)} of {formatBytes(quotaBytes)}
        </span>
      </div>
      <Progress
        value={percent}
        className={isNearFull ? "[&>div]:bg-destructive" : undefined}
      />
    </div>
  );
}
