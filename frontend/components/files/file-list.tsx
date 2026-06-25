"use client";

import { useState } from "react";

import { EmptyState } from "@/components/files/empty-state";
import { FileRow } from "@/components/files/file-row";
import type { FileRecord } from "@/lib/files";

type SortKey = "name" | "type" | "size" | "date";
type SortDir = "asc" | "desc";

interface FileListProps {
  files: FileRecord[];
  onDeleted: (id: string) => void;
}

export function FileList({ files, onDeleted }: FileListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortableHeader({
    label,
    sortKeyValue,
  }: {
    label: string;
    sortKeyValue: SortKey;
  }) {
    const active = sortKey === sortKeyValue;
    return (
      <button
        onClick={() => handleSort(sortKeyValue)}
        className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors ${
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <span className="text-muted-foreground">
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  }

  const sortedFiles = [...files].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name")
      cmp = a.original_filename.localeCompare(b.original_filename);
    if (sortKey === "type") cmp = a.content_type.localeCompare(b.content_type);
    if (sortKey === "size") cmp = a.size_bytes - b.size_bytes;
    if (sortKey === "date")
      cmp =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40 dark:bg-white/5 dark:backdrop-blur-sm">
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
            <th className="py-2.5 pl-4 pr-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              #
            </th>
            <th className="py-2.5 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <SortableHeader label="Name" sortKeyValue="name" />
            </th>
            <th className="py-2.5 px-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="flex justify-center">
                <SortableHeader label="Type" sortKeyValue="type" />
              </div>
            </th>
            <th className="py-2.5 px-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div className="flex justify-end">
                <SortableHeader label="Size" sortKeyValue="size" />
              </div>
            </th>
            <th className="py-2.5 pl-2 pr-4 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <EmptyState />
              </td>
            </tr>
          ) : (
            sortedFiles.map((file, index) => (
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
