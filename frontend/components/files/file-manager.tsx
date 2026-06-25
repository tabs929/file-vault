"use client";

import { Upload } from "lucide-react";
import { useCallback, useState } from "react";

import { FileList } from "@/components/files/file-list";
import { UploadModal } from "@/components/files/upload-zone";
import { UsageBar } from "@/components/files/usage-bar";
import { Button } from "@/components/ui/button";
import { listFiles } from "@/lib/files";
import type { FileListResponse, FileRecord } from "@/lib/files";
import { formatBytes, planDisplayName } from "@/lib/format";

interface FileManagerProps {
  initialData: FileListResponse;
  userEmail: string;
  planName: string;
  emailVerified: boolean;
}

export function FileManager({
  initialData,
  userEmail,
  planName,
  emailVerified,
}: FileManagerProps) {
  const [files, setFiles] = useState<FileRecord[]>(initialData.files);
  const [usedBytes, setUsedBytes] = useState(initialData.used_bytes);
  const [uploadOpen, setUploadOpen] = useState(false);
  const quotaBytes = initialData.quota_bytes;

  const firstName = userEmail.split("@")[0];

  const refresh = useCallback(async () => {
    const data = await listFiles();
    setFiles(data.files);
    setUsedBytes(data.used_bytes);
  }, []);

  function handleDeleted(id: string) {
    const removed = files.find((f) => f.id === id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (removed) setUsedBytes((prev) => Math.max(0, prev - removed.size_bytes));
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {planDisplayName(planName)} ·{" "}
            {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 shrink-0"
          disabled={!emailVerified}
          title={
            !emailVerified
              ? "Verify your email address to enable uploads"
              : undefined
          }
        >
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
      </div>

      {/* Inline storage bar */}
      <UsageBar usedBytes={usedBytes} quotaBytes={quotaBytes} />

      {/* File table */}
      <FileList files={files} onDeleted={handleDeleted} />

      {/* Upload modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        quotaBytes={quotaBytes}
        usedBytes={usedBytes}
        onUploaded={refresh}
      />
    </div>
  );
}
