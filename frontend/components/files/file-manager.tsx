"use client";

import { useCallback, useEffect, useState } from "react";

import { FileList } from "@/components/files/file-list";
import { UploadZone } from "@/components/files/upload-zone";
import { UsageBar } from "@/components/files/usage-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFiles } from "@/lib/files";
import type { FileListResponse, FileRecord } from "@/lib/files";

interface FileManagerProps {
  initialData: FileListResponse;
}

export function FileManager({ initialData }: FileManagerProps) {
  const [files, setFiles] = useState<FileRecord[]>(initialData.files);
  const [usedBytes, setUsedBytes] = useState(initialData.used_bytes);
  const quotaBytes = initialData.quota_bytes;

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
      <Card className="border-border">
        <CardContent className="pt-6">
          <UsageBar usedBytes={usedBytes} quotaBytes={quotaBytes} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Upload a file</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadZone
            quotaBytes={quotaBytes}
            usedBytes={usedBytes}
            onUploaded={refresh}
          />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Your files{files.length > 0 ? ` (${files.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileList files={files} onDeleted={handleDeleted} />
        </CardContent>
      </Card>
    </div>
  );
}
