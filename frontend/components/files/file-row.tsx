"use client";

import {
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  Image,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteFile, getDownloadUrl } from "@/lib/files";
import type { FileRecord } from "@/lib/files";
import { formatBytes } from "@/lib/format";

interface FileRowProps {
  file: FileRecord;
  onDeleted: (id: string) => void;
}

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (contentType === "application/pdf") return <FileType className="h-4 w-4 text-red-500" />;
  if (contentType === "application/json") return <FileJson className="h-4 w-4 text-yellow-500" />;
  if (contentType === "application/zip") return <FileArchive className="h-4 w-4 text-purple-500" />;
  if (contentType.includes("spreadsheet") || contentType.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function FileRow({ file, onDeleted }: FileRowProps) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { download_url } = await getDownloadUrl(file.id);
      window.open(download_url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteFile(file.id);
      onDeleted(file.id);
      toast.success(`${file.original_filename} deleted.`);
    } catch {
      toast.error("Delete failed. Please try again.");
      setDeleting(false);
    }
  }

  const date = new Date(file.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <FileIcon contentType={file.content_type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {file.original_filename}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.size_bytes)} · {date}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={downloading || deleting}
          aria-label={`Download ${file.original_filename}`}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={downloading || deleting}
          aria-label={`Delete ${file.original_filename}`}
          className="text-muted-foreground hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
