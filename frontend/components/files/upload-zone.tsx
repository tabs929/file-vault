"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { confirmUpload, requestUpload, uploadToS3 } from "@/lib/files";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_BYTES = 100 * 1024 * 1024;

interface UploadZoneProps {
  quotaBytes: number;
  usedBytes: number;
  onUploaded: () => void;
}

export function UploadZone({ quotaBytes, usedBytes, onUploaded }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const quotaFull = usedBytes >= quotaBytes;

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(`${file.name}: file type not allowed.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name}: exceeds the 100 MB size limit.`);
      return;
    }
    if (usedBytes + file.size > quotaBytes) {
      toast.error("Not enough storage quota for this file.");
      return;
    }

    setUploading(true);
    try {
      // Step 1: request a presigned PUT URL from the API.
      const { file_id, presigned_url } = await requestUpload(
        file.name,
        file.size,
        file.type
      );

      // Step 2: upload directly to S3 (browser → S3, API not in the path).
      await uploadToS3(presigned_url, file);

      // Step 3: confirm the upload so the API verifies it landed in S3.
      await confirmUpload(file_id);

      toast.success(`${file.name} uploaded.`);
      onUploaded();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  if (quotaFull) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-8 text-center">
        <p className="text-sm font-medium text-destructive">Storage full</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Delete files or upgrade your plan to upload more.
        </p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload file"
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={[
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
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
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />
      {uploading ? (
        <>
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uploading…</p>
        </>
      ) : (
        <>
          <Upload className="mb-3 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Drop a file here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Max 100 MB · Images, PDFs, text, CSV, JSON, ZIP, Office docs
          </p>
        </>
      )}
    </div>
  );
}
