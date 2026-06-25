import { FolderOpen } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-base font-medium text-foreground">No files yet</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Upload your first file to get started
      </p>
    </div>
  );
}
