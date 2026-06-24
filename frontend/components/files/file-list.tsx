"use client";

import { EmptyState } from "@/components/files/empty-state";
import { FileRow } from "@/components/files/file-row";
import type { FileRecord } from "@/lib/files";

interface FileListProps {
  files: FileRecord[];
  onDeleted: (id: string) => void;
}

export function FileList({ files, onDeleted }: FileListProps) {
  if (files.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileRow key={file.id} file={file} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
