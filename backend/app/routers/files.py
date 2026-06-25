import logging
import os
import re
import uuid

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

logger = logging.getLogger(__name__)

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import StorageVerificationError
from app.models.file import File
from app.models.user import User
from app.schemas.files import (
    DownloadResponse,
    FileListResponse,
    FileResponse,
    RequestUploadRequest,
    RequestUploadResponse,
)
from app.services import quota_service, storage_service

router = APIRouter(redirect_slashes=False)

MAX_FILE_BYTES = 100 * 1024 * 1024  # 100 MB hard cap regardless of plan

ALLOWED_CONTENT_TYPES = {
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
}


def _safe_filename(filename: str) -> str:
    name = os.path.basename(filename.replace("\\", "/"))
    name = re.sub(r"[^\w\-.]", "_", name)
    return (name[:200] or "file").lower()


@router.post("/request-upload", response_model=RequestUploadResponse, status_code=201)
async def request_upload(
    body: RequestUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RequestUploadResponse:
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required before uploading files.",
        )

    if body.size_bytes > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {MAX_FILE_BYTES} bytes.",
        )
    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Content type '{body.content_type}' is not allowed.",
        )

    # Quota check + reserve: SELECT FOR UPDATE then increment used_bytes.
    # Both happen in this transaction so the lock covers the increment.
    await quota_service.check_and_reserve_quota(db, current_user.id, body.size_bytes)

    safe_name = _safe_filename(body.filename)
    storage_key = f"{current_user.id}/{uuid.uuid4()}/{safe_name}"

    file_record = File(
        owner_id=current_user.id,
        original_filename=body.filename,
        storage_key=storage_key,
        size_bytes=body.size_bytes,
        content_type=body.content_type,
        upload_status="pending",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    presigned_url = storage_service.generate_presigned_put(storage_key, body.content_type)

    return RequestUploadResponse(
        file_id=file_record.id,
        presigned_url=presigned_url,
        storage_key=storage_key,
    )


@router.post(
    "/confirm-upload/{file_id}",
    response_model=FileResponse,
    status_code=200,
)
async def confirm_upload(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    # Scope by owner_id. Return 404 not 403 — callers cannot confirm
    # whether a resource exists at another user's ID. IDOR defense.
    result = await db.execute(
        select(File).where(File.id == file_id, File.owner_id == current_user.id)
    )
    file_record = result.scalar_one_or_none()
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    if file_record.upload_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="File is already confirmed.",
        )

    # Verify the object actually landed in S3 before marking it confirmed.
    if not await storage_service.object_exists(file_record.storage_key):
        raise StorageVerificationError()

    # Verify actual uploaded size matches the declared size to prevent
    # clients from declaring a small size but uploading a large file.
    actual_size = await storage_service.get_object_size(file_record.storage_key)
    if actual_size != file_record.size_bytes:
        # Size mismatch: roll back the reserved bytes and delete the stale record.
        result2 = await db.execute(
            select(User)
            .options(noload(User.plan))
            .where(User.id == current_user.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        owner = result2.scalar_one()
        owner.used_bytes = max(0, owner.used_bytes - file_record.size_bytes)
        await db.delete(file_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file size does not match declared size.",
        )

    file_record.upload_status = "confirmed"
    await db.commit()
    await db.refresh(file_record)

    return FileResponse.model_validate(file_record)


@router.get("", response_model=FileListResponse)
@router.get("/", response_model=FileListResponse)
async def list_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileListResponse:
    result = await db.execute(
        select(File)
        .where(File.owner_id == current_user.id, File.upload_status == "confirmed")
        .order_by(File.created_at.desc())
    )
    files = result.scalars().all()

    return FileListResponse(
        files=[FileResponse.model_validate(f) for f in files],
        total=len(files),
        used_bytes=current_user.used_bytes,
        quota_bytes=current_user.plan.quota_bytes,
    )


@router.get("/{file_id}/download", response_model=DownloadResponse)
async def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DownloadResponse:
    # Scope by owner_id. Return 404 not 403 — callers cannot confirm
    # whether a resource exists at another user's ID. IDOR defense.
    result = await db.execute(
        select(File).where(File.id == file_id, File.owner_id == current_user.id)
    )
    file_record = result.scalar_one_or_none()
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    if file_record.upload_status != "confirmed":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    download_url = storage_service.generate_presigned_get(file_record.storage_key)

    return DownloadResponse(
        download_url=download_url,
        filename=file_record.original_filename,
        expires_in=300,
    )


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # Scope by owner_id. Return 404 not 403 — callers cannot confirm
    # whether a resource exists at another user's ID. IDOR defense.
    result = await db.execute(
        select(File).where(File.id == file_id, File.owner_id == current_user.id)
    )
    file_record = result.scalar_one_or_none()
    if file_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    try:
        await storage_service.delete_object(file_record.storage_key)
    except ClientError as e:
        logger.error(f"S3 delete failed for key={file_record.storage_key} file_id={file_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file from storage.",
        )

    result2 = await db.execute(
        select(User)
        .options(noload(User.plan))
        .where(User.id == current_user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    owner = result2.scalar_one()
    owner.used_bytes = max(0, owner.used_bytes - file_record.size_bytes)

    await db.delete(file_record)
    await db.commit()
