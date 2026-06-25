"use client";

import { EmptyState } from "@/components/files/empty-state";
import { FileRow } from "@/components/files/file-row";
import type { FileRecord } from "@/lib/files";

interface FileListProps {
  files: FileRecord[];
  onDeleted: (id: string) => void;
}

export function FileList({ files, onDeleted }: FileListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full table-fixed">
        <colgroup>
          <col className="w-11" />
          <col />
          <col className="w-20" />
          <col className="w-20" />
          <col className="w-28" />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              #
            </th>
            <th className="py-2.5 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </th>
            <th className="py-2.5 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </th>
            <th className="py-2.5 px-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Size
            </th>
            <th className="py-2.5 pl-2 pr-4 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {files.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState />
              </td>
            </tr>
          ) : (
            files.map((file, index) => (
              <FileRow
                key={file.id}
                file={file}
                index={index}
                onDeleted={onDeleted}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
