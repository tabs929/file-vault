"use client";

import { Download, Eye, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { openFilePreview } from "@/components/files/file-preview";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteFile, getDownloadUrl } from "@/lib/files";
import type { FileRecord } from "@/lib/files";
import { formatBytes } from "@/lib/format";

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ contentType }: { contentType: string }) {
  let label: string;
  let cls: string;

  if (contentType === "application/pdf") {
    label = "PDF";
    cls = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  } else if (contentType.startsWith("image/")) {
    const sub = contentType.split("/")[1].toUpperCase();
    label = sub === "JPEG" ? "JPG" : sub;
    cls = "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  } else if (contentType === "application/zip") {
    label = "ZIP";
    cls = "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  } else if (
    contentType === "application/msword" ||
    contentType.includes("wordprocessingml")
  ) {
    label = "DOCX";
    cls = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  } else if (
    contentType === "application/vnd.ms-excel" ||
    contentType.includes("spreadsheetml")
  ) {
    label = "XLSX";
    cls = "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
  } else if (contentType === "application/json") {
    label = "JSON";
    cls = "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
  } else if (contentType === "text/csv") {
    label = "CSV";
    cls = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  } else {
    const sub = contentType.split("/")[1].toUpperCase();
    label = sub === "PLAIN" ? "TXT" : sub;
    cls = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ── Ghost action button ───────────────────────────────────────────────────────

interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive";
  loading?: boolean;
  "aria-label": string;
}

function GhostButton({
  variant = "default",
  loading,
  children,
  disabled,
  ...props
}: GhostButtonProps) {
  const base =
    "h-7 w-7 rounded-md flex items-center justify-center border border-transparent bg-transparent transition-colors disabled:opacity-40 disabled:pointer-events-none";
  const hoverCls =
    variant === "destructive"
      ? "text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      : "text-muted-foreground hover:border-border hover:bg-muted";

  return (
    <button
      className={`${base} ${hoverCls}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

// ── FileRow ───────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileRecord;
  index: number;
  onDeleted: (id: string) => void;
}

export function FileRow({ file, index, onDeleted }: FileRowProps) {
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const busy = previewing || downloading || deleting;

  async function handlePreview() {
    setPreviewing(true);
    try {
      await openFilePreview(file.id, file.content_type, file.original_filename);
    } catch {
      toast.error("Could not open preview. Please try again.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const { download_url } = await getDownloadUrl(file.id);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
      setDeleteOpen(false);
      onDeleted(file.id);
      toast.success(`${file.original_filename} deleted.`);
    } catch {
      toast.error("Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
        {/* # */}
        <td className="hidden sm:table-cell py-3 pl-4 pr-2 text-center text-[13px] tabular-nums text-muted-foreground">
          {index + 1}
        </td>

        {/* Name + date */}
        <td className="min-w-0 py-3 px-4">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={file.original_filename}
          >
            {file.original_filename}
          </p>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="sm:hidden">
              {new Date(file.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="hidden sm:inline">
              {new Date(file.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </td>

        {/* Type */}
        <td className="hidden sm:table-cell py-3 px-2 text-center">
          <TypeBadge contentType={file.content_type} />
        </td>

        {/* Size */}
        <td className="hidden sm:table-cell py-3 px-2 text-right text-[13px] tabular-nums text-muted-foreground">
          {formatBytes(file.size_bytes)}
        </td>

        {/* Actions */}
        <td className="py-3 pl-2 pr-4">
          <div className="flex items-center justify-center gap-1">
            <GhostButton
              aria-label={`Preview ${file.original_filename}`}
              loading={previewing}
              disabled={busy}
              onClick={handlePreview}
            >
              <Eye className="h-3.5 w-3.5" />
            </GhostButton>
            <GhostButton
              aria-label={`Download ${file.original_filename}`}
              loading={downloading}
              disabled={busy}
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </GhostButton>
            <GhostButton
              variant="destructive"
              aria-label={`Delete ${file.original_filename}`}
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </GhostButton>
          </div>
        </td>
      </tr>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {file.original_filename}
              </span>{" "}
              and free up {formatBytes(file.size_bytes)}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
