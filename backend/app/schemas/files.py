import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class RequestUploadRequest(BaseModel):
    filename: str
    size_bytes: int
    content_type: str

    @field_validator("filename")
    @classmethod
    def filename_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("filename must not be empty")
        return v

    @field_validator("size_bytes")
    @classmethod
    def size_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("size_bytes must be positive")
        return v


class RequestUploadResponse(BaseModel):
    file_id: uuid.UUID
    presigned_url: str
    storage_key: str


class FileResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    size_bytes: int
    content_type: str
    upload_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FileListResponse(BaseModel):
    files: list[FileResponse]
    total: int
    used_bytes: int
    quota_bytes: int


class DownloadResponse(BaseModel):
    download_url: str
    filename: str
    expires_in: int
