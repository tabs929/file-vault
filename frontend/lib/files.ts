import { apiFetch } from "@/lib/api";

export interface FileRecord {
  id: string;
  original_filename: string;
  size_bytes: number;
  content_type: string;
  upload_status: string;
  created_at: string;
}

export interface FileListResponse {
  files: FileRecord[];
  total: number;
  used_bytes: number;
  quota_bytes: number;
}

export interface RequestUploadResponse {
  file_id: string;
  presigned_url: string;
  storage_key: string;
}

export interface DownloadResponse {
  download_url: string;
  filename: string;
  expires_in: number;
}

export async function requestUpload(
  filename: string,
  size_bytes: number,
  content_type: string
): Promise<RequestUploadResponse> {
  return apiFetch<RequestUploadResponse>("/files/request-upload", {
    method: "POST",
    body: JSON.stringify({ filename, size_bytes, content_type }),
  });
}

export async function uploadToS3(
  presigned_url: string,
  file: File
): Promise<void> {
  const resp = await fetch(presigned_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!resp.ok) {
    throw new Error(`S3 upload failed: ${resp.status} ${resp.statusText}`);
  }
}

export async function confirmUpload(file_id: string): Promise<FileRecord> {
  return apiFetch<FileRecord>(`/files/confirm-upload/${file_id}`, {
    method: "POST",
  });
}

export async function listFiles(): Promise<FileListResponse> {
  return apiFetch<FileListResponse>("/files/");
}

export async function getDownloadUrl(file_id: string): Promise<DownloadResponse> {
  return apiFetch<DownloadResponse>(`/files/${file_id}/download`);
}

export async function deleteFile(file_id: string): Promise<void> {
  return apiFetch<void>(`/files/${file_id}`, { method: "DELETE" });
}
