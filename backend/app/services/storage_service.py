import asyncio
import logging
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Storage keys are server-generated. Never use the client-provided
# filename as the key — path traversal prevention.
# Presigned URLs are signed for a specific host and expire in minutes.
# The bucket remains private with Block Public Access on.

_PRESIGN_PUT_EXPIRY = 900   # 15 minutes
_PRESIGN_GET_EXPIRY = 300   # 5 minutes


def _make_client(endpoint_url: str) -> Any:
    kwargs: dict[str, Any] = {
        "region_name": settings.S3_REGION,
        "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
    }
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        # Force path-style: http://host:port/bucket/key
        # Virtual-host style (http://bucket.host:port/key) fails on MinIO
        # because browsers/DNS can't resolve the bucket-prefixed hostname.
        kwargs["config"] = Config(s3={"addressing_style": "path"})
    return boto3.client("s3", **kwargs)


# Internal client: used for object_exists and delete (server-to-S3 network calls).
# Public client: used for generating presigned URLs the browser will hit directly.
# In local Docker: internal=minio:9000, public=localhost:9000.
# In production (real AWS): both endpoints are empty — boto3 uses AWS defaults.
def _internal_client() -> Any:
    return _make_client(settings.S3_ENDPOINT_URL)


def _public_client() -> Any:
    endpoint = settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL
    return _make_client(endpoint)


def generate_presigned_put(storage_key: str, content_type: str) -> str:
    """Generate a presigned PUT URL. Purely local computation — no I/O, no thread needed."""
    client = _public_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=_PRESIGN_PUT_EXPIRY,
    )


def generate_presigned_get(storage_key: str) -> str:
    """Generate a presigned GET URL. Purely local computation — no I/O, no thread needed."""
    client = _public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": storage_key,
        },
        ExpiresIn=_PRESIGN_GET_EXPIRY,
    )


async def object_exists(storage_key: str) -> bool:
    """Check whether the object is present in S3. Runs in a thread (boto3 is sync)."""
    def _check() -> bool:
        try:
            _internal_client().head_object(
                Bucket=settings.S3_BUCKET, Key=storage_key
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            raise

    return await asyncio.to_thread(_check)


async def get_object_size(storage_key: str) -> int:
    """Return the actual byte size of the stored object via HeadObject."""
    def _head() -> int:
        resp = _internal_client().head_object(
            Bucket=settings.S3_BUCKET, Key=storage_key
        )
        return int(resp["ContentLength"])

    return await asyncio.to_thread(_head)


async def delete_object(storage_key: str) -> None:
    """Delete an object from S3. Runs in a thread (boto3 is sync)."""
    def _delete() -> None:
        try:
            _internal_client().delete_object(
                Bucket=settings.S3_BUCKET, Key=storage_key
            )
        except ClientError as e:
            logger.error(f"S3 delete failed for {storage_key}: {e}")
            raise

    await asyncio.to_thread(_delete)
