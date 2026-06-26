"use client";

import { getDownloadUrl, getPreviewUrl } from "@/lib/files";

const BROWSER_PREVIEWABLE = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/svg+xml",
  "image/tiff",
]);

export async function openFilePreview(
  fileId: string,
  contentType: string,
  filename: string
): Promise<void> {
  if (BROWSER_PREVIEWABLE.has(contentType)) {
    const { download_url } = await getPreviewUrl(fileId);
    window.open(download_url, "_blank", "noopener,noreferrer");
  } else {
    const { download_url } = await getDownloadUrl(fileId);
    const a = document.createElement("a");
    a.href = download_url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
