"use client";

import { getDownloadUrl } from "@/lib/files";

const BROWSER_PREVIEWABLE = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function openFilePreview(
  fileId: string,
  contentType: string,
  filename: string
): Promise<void> {
  const { download_url } = await getDownloadUrl(fileId);

  if (BROWSER_PREVIEWABLE.has(contentType)) {
    window.open(download_url, "_blank", "noopener,noreferrer");
  } else {
    const a = document.createElement("a");
    a.href = download_url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
