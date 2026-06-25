"""
Tests for the /files endpoints.

S3 operations are mocked via unittest.mock so these tests run without a live
MinIO/S3 service. The quota race-condition test is noted separately — it
requires two real concurrent transactions and cannot run under the single
rolled-back db_session fixture; see the docstring on that test for context.
"""

import re
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.conftest import login_and_get_cookie

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_UPLOAD_BODY = {
    "filename": "test.pdf",
    "size_bytes": 1024,
    "content_type": "application/pdf",
}

_EMAIL_PATCH = "app.services.email_service._resend_send"


async def _register_and_login(client: AsyncClient, email: str, password: str) -> str:
    """Register, auto-verify email (by consuming the emitted token), then log in."""
    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(_EMAIL_PATCH, side_effect=_capture):
        await client.post(
            "/auth/register",
            json={"email": email, "password": password, "plan_name": "free"},
        )

    # Consume the verification token so the user can upload files.
    if captured:
        match = re.search(r"token=([A-Za-z0-9_\-]+)", captured[0].get("html", ""))
        if match:
            await client.get(f"/auth/verify-email?token={match.group(1)}")

    return await login_and_get_cookie(client, email, password)


async def _do_request_upload(client: AsyncClient, cookie: str, body: dict | None = None) -> dict:
    body = body or _UPLOAD_BODY
    resp = await client.post(
        "/files/request-upload",
        json=body,
        cookies={"session": cookie},
    )
    return resp


# ---------------------------------------------------------------------------
# Upload happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_happy_path(client: AsyncClient) -> None:
    """Full two-step upload: request → confirm → appears in list."""
    cookie = await _register_and_login(client, "uploader@example.com", "pass-word-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/presigned-put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=1024,
        ),
    ):
        resp = await _do_request_upload(client, cookie)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert "file_id" in data
        assert data["presigned_url"] == "https://minio/presigned-put"

        file_id = data["file_id"]
        confirm = await client.post(
            f"/files/confirm-upload/{file_id}",
            cookies={"session": cookie},
        )
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["upload_status"] == "confirmed"

    # File appears in list
    list_resp = await client.get("/files/", cookies={"session": cookie})
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert body["total"] == 1
    assert body["files"][0]["original_filename"] == "test.pdf"


# ---------------------------------------------------------------------------
# IDOR: user A cannot access user B's files
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_idor_download_returns_404(client: AsyncClient) -> None:
    """User B cannot download a file owned by user A — must get 404, not 403."""
    cookie_a = await _register_and_login(client, "alice@example.com", "alice-pass-123!")
    cookie_b = await _register_and_login(client, "bob@example.com", "bob-pass-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/presigned-put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=1024,
        ),
    ):
        req = await _do_request_upload(client, cookie_a)
        file_id = req.json()["file_id"]
        await client.post(f"/files/confirm-upload/{file_id}", cookies={"session": cookie_a})

    with patch(
        "app.services.storage_service.generate_presigned_get",
        return_value="https://minio/presigned-get",
    ):
        resp = await client.get(
            f"/files/{file_id}/download",
            cookies={"session": cookie_b},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_idor_delete_returns_404(client: AsyncClient) -> None:
    """User B cannot delete a file owned by user A — must get 404, not 403."""
    cookie_a = await _register_and_login(client, "alice2@example.com", "alice-pass-123!")
    cookie_b = await _register_and_login(client, "bob2@example.com", "bob-pass-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/presigned-put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=1024,
        ),
    ):
        req = await _do_request_upload(client, cookie_a)
        file_id = req.json()["file_id"]
        await client.post(f"/files/confirm-upload/{file_id}", cookies={"session": cookie_a})

    with patch("app.services.storage_service.delete_object", new_callable=AsyncMock):
        resp = await client.delete(
            f"/files/{file_id}",
            cookies={"session": cookie_b},
        )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Quota enforcement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_quota_exceeded_returns_413(client: AsyncClient) -> None:
    """Upload that exceeds the free plan quota (100 MB) returns 413."""
    cookie = await _register_and_login(client, "quota@example.com", "quota-pass-123!")

    oversized_body = {
        "filename": "huge.zip",
        "size_bytes": 105 * 1024 * 1024,  # 105 MB — above hard cap
        "content_type": "application/zip",
    }
    resp = await _do_request_upload(client, cookie, oversized_body)
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_quota_soft_limit_returns_413(client: AsyncClient) -> None:
    """Upload that would exceed used_bytes + size_bytes > quota returns 413."""
    cookie = await _register_and_login(client, "quota2@example.com", "quota-pass-123!")

    # Fill up almost all quota with two uploads
    chunk = 40 * 1024 * 1024  # 40 MB each — two fit, three don't (free = 100 MB)

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=chunk,
        ),
    ):
        for i in range(2):
            req = await _do_request_upload(
                client,
                cookie,
                {"filename": f"part{i}.zip", "size_bytes": chunk, "content_type": "application/zip"},
            )
            assert req.status_code == 201
            fid = req.json()["file_id"]
            confirm = await client.post(f"/files/confirm-upload/{fid}", cookies={"session": cookie})
            assert confirm.status_code == 200

    # Third 40 MB chunk would push to 120 MB — over quota
    with patch(
        "app.services.storage_service.generate_presigned_put",
        return_value="https://minio/put",
    ):
        third = await _do_request_upload(
            client,
            cookie,
            {"filename": "third.zip", "size_bytes": chunk, "content_type": "application/zip"},
        )
    assert third.status_code == 413


# ---------------------------------------------------------------------------
# used_bytes timing: incremented at confirm, not at request
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_used_bytes_incremented_at_confirm_not_request(client: AsyncClient) -> None:
    """used_bytes stays 0 after request-upload and equals file_size after confirm-upload."""
    cookie = await _register_and_login(client, "quota_timing@example.com", "quota-timing-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=1024,
        ),
    ):
        req = await _do_request_upload(client, cookie)
        assert req.status_code == 201
        file_id = req.json()["file_id"]

        after_request = await client.get("/files/", cookies={"session": cookie})
        assert after_request.json()["used_bytes"] == 0

        confirm = await client.post(f"/files/confirm-upload/{file_id}", cookies={"session": cookie})
        assert confirm.status_code == 200

    after_confirm = await client.get("/files/", cookies={"session": cookie})
    assert after_confirm.json()["used_bytes"] == 1024


# ---------------------------------------------------------------------------
# Confirm with no S3 object
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_confirm_without_s3_object_returns_422(client: AsyncClient) -> None:
    """confirm-upload returns 422 when the object isn't present in S3."""
    cookie = await _register_and_login(client, "noobj@example.com", "no-obj-pass-123!")

    with patch(
        "app.services.storage_service.generate_presigned_put",
        return_value="https://minio/put",
    ):
        req = await _do_request_upload(client, cookie)
    assert req.status_code == 201
    file_id = req.json()["file_id"]

    with patch(
        "app.services.storage_service.object_exists",
        new_callable=AsyncMock,
        return_value=False,
    ):
        resp = await client.post(f"/files/confirm-upload/{file_id}", cookies={"session": cookie})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Delete decrements used_bytes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_decrements_used_bytes(client: AsyncClient) -> None:
    """Deleting a file decrements the owner's used_bytes."""
    cookie = await _register_and_login(client, "deleter@example.com", "del-pass-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=1024,
        ),
    ):
        req = await _do_request_upload(client, cookie)
        file_id = req.json()["file_id"]
        await client.post(f"/files/confirm-upload/{file_id}", cookies={"session": cookie})

    list_before = await client.get("/files/", cookies={"session": cookie})
    assert list_before.json()["used_bytes"] == 1024

    with patch("app.services.storage_service.delete_object", new_callable=AsyncMock):
        del_resp = await client.delete(f"/files/{file_id}", cookies={"session": cookie})
    assert del_resp.status_code == 204

    list_after = await client.get("/files/", cookies={"session": cookie})
    assert list_after.json()["used_bytes"] == 0
    assert list_after.json()["total"] == 0


# ---------------------------------------------------------------------------
# List isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_only_returns_own_files(client: AsyncClient) -> None:
    """GET /files returns only files owned by the authenticated user."""
    cookie_a = await _register_and_login(client, "lister_a@example.com", "list-pass-123!")
    cookie_b = await _register_and_login(client, "lister_b@example.com", "list-pass-123!")

    with (
        patch(
            "app.services.storage_service.generate_presigned_put",
            return_value="https://minio/put",
        ),
        patch(
            "app.services.storage_service.object_exists",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "app.services.storage_service.get_object_size",
            new_callable=AsyncMock,
            return_value=512,
        ),
    ):
        req_a = await _do_request_upload(
            client, cookie_a,
            {"filename": "a.pdf", "size_bytes": 512, "content_type": "application/pdf"},
        )
        fid_a = req_a.json()["file_id"]
        await client.post(f"/files/confirm-upload/{fid_a}", cookies={"session": cookie_a})

        req_b = await _do_request_upload(
            client, cookie_b,
            {"filename": "b.pdf", "size_bytes": 512, "content_type": "application/pdf"},
        )
        fid_b = req_b.json()["file_id"]
        await client.post(f"/files/confirm-upload/{fid_b}", cookies={"session": cookie_b})

    list_a = await client.get("/files/", cookies={"session": cookie_a})
    list_b = await client.get("/files/", cookies={"session": cookie_b})

    assert list_a.json()["total"] == 1
    assert list_a.json()["files"][0]["original_filename"] == "a.pdf"

    assert list_b.json()["total"] == 1
    assert list_b.json()["files"][0]["original_filename"] == "b.pdf"


# ---------------------------------------------------------------------------
# Race condition note
# ---------------------------------------------------------------------------
# The quota race condition (two concurrent uploads both passing the check
# individually but together exceeding the limit) CANNOT be tested under the
# single rolled-back db_session fixture in conftest.py — that fixture binds
# a single connection per test, so two goroutines cannot each hold a separate
# transaction and contend on the row lock.
#
# To test this properly requires two independent async_sessionmakers each
# with their own connection pool, real commits, and manual cleanup. That
# setup is left as a future integration-test harness task. The SELECT FOR
# UPDATE logic in quota_service.py is the correct implementation; the
# in-process unit tests above verify the quota threshold logic but not the
# concurrency invariant.
