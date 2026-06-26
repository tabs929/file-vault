"use client";

import {
  CheckCircle2,
  CloudUpload,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  Image,
  Loader2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ApiError } from "@/lib/api";
import { confirmUpload, requestUpload, uploadToS3 } from "@/lib/files";
import { formatBytes } from "@/lib/format";

// ── Upload constraints ───────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/svg+xml",
  "image/tiff",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain",
  "text/csv",
  "text/markdown",
  // Data / archives
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
]);

const MAX_BYTES = 100 * 1024 * 1024;

// ── Queue item types ──────────────────────────────────────────────────────────

type ItemStatus = "pending" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
  status: ItemStatus;
  progress: number; // 0 | 33 | 66 | 100
  error?: string;
}

// ── Small file-type icon for queue rows ───────────────────────────────────────

function QueueFileIcon({ contentType }: { contentType: string }) {
  const cls = "h-4 w-4 shrink-0";
  if (contentType === "application/pdf")
    return <FileType className={`${cls} text-red-500`} />;
  if (contentType.startsWith("image/"))
    return <Image className={`${cls} text-violet-500`} />;
  if (contentType === "application/zip")
    return <FileArchive className={`${cls} text-amber-500`} />;
  if (
    contentType === "application/msword" ||
    contentType.includes("wordprocessingml")
  )
    return <FileText className={`${cls} text-blue-500`} />;
  if (
    contentType === "application/vnd.ms-excel" ||
    contentType.includes("spreadsheetml")
  )
    return <FileSpreadsheet className={`${cls} text-green-500`} />;
  if (contentType === "application/json")
    return <FileJson className={`${cls} text-yellow-500`} />;
  if (contentType === "text/csv")
    return <FileSpreadsheet className={`${cls} text-emerald-500`} />;
  return <FileText className={`${cls} text-muted-foreground`} />;
}

// ── UploadModal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  quotaBytes: number;
  usedBytes: number;
  onUploaded: () => void;
}

export function UploadModal({
  open,
  onClose,
  quotaBytes,
  usedBytes,
  onUploaded,
}: UploadModalProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── State helpers ───────────────────────────────────────────────────────────

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  // ── Add files to queue ──────────────────────────────────────────────────────

  function enqueueFiles(files: File[]) {
    const pendingBytes = queue
      .filter((i) => i.status === "pending" || i.status === "uploading")
      .reduce((sum, i) => sum + i.file.size, 0);

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast.error(`${file.name}: file type not allowed.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: exceeds the 100 MB size limit.`);
        continue;
      }
      if (usedBytes + pendingBytes + file.size > quotaBytes) {
        toast.error(`${file.name}: not enough storage quota.`);
        continue;
      }
      setQueue((prev) => [
        ...prev,
        {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          status: "pending",
          progress: 0,
        },
      ]);
    }
  }

  // ── Upload one item ─────────────────────────────────────────────────────────

  async function uploadOne(item: QueueItem): Promise<void> {
    updateItem(item.id, { status: "uploading", progress: 0 });

    const { file_id, presigned_url } = await requestUpload(
      item.file.name,
      item.file.size,
      item.file.type
    );
    updateItem(item.id, { progress: 33 });

    await uploadToS3(presigned_url, item.file);
    updateItem(item.id, { progress: 66 });

    await confirmUpload(file_id);
    updateItem(item.id, { status: "done", progress: 100 });
  }

  // ── Upload all in parallel ──────────────────────────────────────────────────

  async function handleUploadAll() {
    const pending = queue.filter(
      (i) => i.status === "pending" || i.status === "error"
    );
    if (pending.length === 0) return;

    setUploading(true);

    const results = await Promise.allSettled(
      pending.map((item) =>
        uploadOne(item).catch((err) => {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
              ? err.message
              : "Upload failed";
          updateItem(item.id, { status: "error", error: msg, progress: 0 });
          throw err;
        })
      )
    );

    setUploading(false);

    const allSucceeded = results.every((r) => r.status === "fulfilled");
    if (allSucceeded) {
      onUploaded();
      handleClose();
    }
    // partial failure: keep modal open so user sees which files failed
  }

  // ── Close (blocked while uploading) ────────────────────────────────────────

  function handleClose() {
    if (uploading) return;
    setQueue([]);
    onClose();
  }

  // ── Drop zone handlers ──────────────────────────────────────────────────────

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    enqueueFiles(Array.from(e.dataTransfer.files));
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) enqueueFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  const pendingCount = queue.filter(
    (i) => i.status === "pending" || i.status === "error"
  ).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) handleClose(); }}>
      <DialogContent
        className="w-[95vw] sm:max-w-md"
        onInteractOutside={(e: Event) => { if (uploading) e.preventDefault(); }}
        onEscapeKeyDown={(e: KeyboardEvent) => { if (uploading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Select files to upload"
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) =>
            e.key === "Enter" && !uploading && inputRef.current?.click()
          }
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
            uploading ? "pointer-events-none opacity-60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onInputChange}
            disabled={uploading}
          />
          <CloudUpload className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Drop files here or browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Max 100 MB · Images (HEIC, PNG, JPG…), PDFs, Office docs, text, CSV, JSON, ZIP
          </p>
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                <QueueFileIcon contentType={item.file.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-sm font-medium text-foreground"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatBytes(item.file.size)}
                      </span>
                      {item.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {item.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {(item.status === "pending" ||
                        item.status === "error") && (
                        <button
                          onClick={() => removeItem(item.id)}
                          title={item.error}
                          aria-label={`Remove ${item.file.name}`}
                          className={`flex h-4 w-4 items-center justify-center rounded transition-colors hover:opacity-70 ${
                            item.status === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={item.progress}
                    className={`mt-1.5 h-[3px] ${item.status === "error" ? "[&>div]:bg-destructive" : ""}`}
                  />
                  {item.status === "error" && item.error && (
                    <p className="mt-0.5 text-[11px] text-destructive">
                      {item.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadAll}
            disabled={uploading || pendingCount === 0}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              `Upload ${pendingCount > 0 ? pendingCount : ""} file${pendingCount !== 1 ? "s" : ""}`.trim()
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
