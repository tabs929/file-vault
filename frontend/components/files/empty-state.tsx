"use client";

import { Upload } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Upload className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">No files yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a file to get started.
      </p>
    </div>
  );
}
