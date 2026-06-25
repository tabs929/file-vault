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
    <div className="flex items-center gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">Storage</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${isNearFull ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
      </span>
    </div>
  );
}
