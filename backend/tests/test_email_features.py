"""Phase 4 — Email Features tests.

All email sends are patched at the service layer so tests never hit the
Resend API. The patch target is the module-level `_resend_send` helper
inside email_service, which is the only function that calls `resend.Emails.send`.
"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token import VerificationToken
from app.models.user import User

# ── Helpers ───────────────────────────────────────────────────────────────────

EMAIL_PATCH = "app.services.email_service._resend_send"


async def _register(client: AsyncClient, email: str = "user@example.com") -> dict:
    with patch(EMAIL_PATCH):
        resp = await client.post(
            "/auth/register",
            json={"email": email, "password": "secure-pass-123", "plan_name": "free"},
        )
    assert resp.status_code == 201
    return resp.json()


async def _login(client: AsyncClient, email: str = "user@example.com") -> None:
    resp = await client.post(
        "/auth/login",
        json={"email": email, "password": "secure-pass-123"},
    )
    assert resp.status_code == 200


async def _get_latest_token(
    db: AsyncSession, user_id, token_type: str
) -> VerificationToken | None:
    result = await db.execute(
        select(VerificationToken)
        .where(
            VerificationToken.user_id == user_id,
            VerificationToken.token_type == token_type,
        )
        .order_by(VerificationToken.created_at.desc())
    )
    return result.scalars().first()


# ── Registration sends verification email ────────────────────────────────────


@pytest.mark.asyncio
async def test_register_creates_verification_token(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    with patch(EMAIL_PATCH) as mock_send:
        resp = await client.post(
            "/auth/register",
            json={"email": "newuser@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )
    assert resp.status_code == 201
    assert mock_send.called

    user_id = resp.json()["id"]
    token = await _get_latest_token(db_session, user_id, "email_verification")
    assert token is not None
    assert token.used_at is None


@pytest.mark.asyncio
async def test_register_email_verified_is_false(
    client: AsyncClient,
) -> None:
    with patch(EMAIL_PATCH):
        resp = await client.post(
            "/auth/register",
            json={"email": "verify@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )
    assert resp.json()["email_verified"] is False


# ── Resend verification ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resend_verification_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/auth/resend-verification")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_resend_verification_sends_email(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _register(client, "resend@example.com")
    await _login(client, "resend@example.com")

    with patch(EMAIL_PATCH) as mock_send:
        resp = await client.post("/auth/resend-verification")
    assert resp.status_code == 200
    assert mock_send.called


@pytest.mark.asyncio
async def test_resend_verification_invalidates_old_token(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Resending replaces the previous unused token."""
    await _register(client, "resend2@example.com")
    await _login(client, "resend2@example.com")

    result = await db_session.execute(
        select(User).where(User.email == "resend2@example.com")
    )
    user = result.scalar_one()
    first_token = await _get_latest_token(db_session, user.id, "email_verification")
    assert first_token is not None

    with patch(EMAIL_PATCH):
        await client.post("/auth/resend-verification")

    # Refresh — the old token should be gone (deleted by create_token)
    result2 = await db_session.execute(
        select(VerificationToken).where(
            VerificationToken.user_id == user.id,
            VerificationToken.token_type == "email_verification",
        )
    )
    tokens = result2.scalars().all()
    # Only one token should remain
    assert len(tokens) == 1
    assert tokens[0].id != first_token.id


@pytest.mark.asyncio
async def test_resend_verification_already_verified(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    await _register(client, "verified@example.com")

    # Manually verify the user
    result = await db_session.execute(
        select(User).where(User.email == "verified@example.com")
    )
    user = result.scalar_one()
    user.email_verified = True
    await db_session.commit()

    await _login(client, "verified@example.com")
    resp = await client.post("/auth/resend-verification")
    assert resp.status_code == 200
    assert "already verified" in resp.json()["message"]


# ── Verify email ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_email_success(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(EMAIL_PATCH, side_effect=_capture):
        resp = await client.post(
            "/auth/register",
            json={"email": "toverify@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    # Extract token from the verification URL in the email
    sent_html = captured[0]["html"]
    import re
    match = re.search(r"token=([A-Za-z0-9_\-]+)", sent_html)
    assert match, "token not found in email HTML"
    raw_token = match.group(1)

    verify_resp = await client.get(f"/auth/verify-email?token={raw_token}")
    assert verify_resp.status_code == 200
    assert "verified" in verify_resp.json()["message"]

    # User should now be marked verified in the DB
    result = await db_session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    # Refresh from DB
    await db_session.refresh(user)
    assert user.email_verified is True


@pytest.mark.asyncio
async def test_verify_email_invalid_token(client: AsyncClient) -> None:
    resp = await client.get("/auth/verify-email?token=totallyinvalidtoken")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_verify_email_token_cannot_be_reused(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(EMAIL_PATCH, side_effect=_capture):
        await client.post(
            "/auth/register",
            json={"email": "reuse@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    import re
    match = re.search(r"token=([A-Za-z0-9_\-]+)", captured[0]["html"])
    raw_token = match.group(1)

    r1 = await client.get(f"/auth/verify-email?token={raw_token}")
    assert r1.status_code == 200

    r2 = await client.get(f"/auth/verify-email?token={raw_token}")
    assert r2.status_code == 400


# ── Forgot password ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_returns_200(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert resp.status_code == 200
    assert "password reset link" in resp.json()["message"]


@pytest.mark.asyncio
async def test_forgot_password_unverified_user_no_email(
    client: AsyncClient,
) -> None:
    """Unverified users do not receive reset emails — prevents reset-as-verification bypass."""
    with patch(EMAIL_PATCH):
        await client.post(
            "/auth/register",
            json={"email": "unverified@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    with patch(EMAIL_PATCH) as mock_send:
        resp = await client.post(
            "/auth/forgot-password",
            json={"email": "unverified@example.com"},
        )
    assert resp.status_code == 200
    mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_forgot_password_verified_user_sends_email(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    with patch(EMAIL_PATCH):
        await client.post(
            "/auth/register",
            json={"email": "pwreset@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    # Verify the user
    result = await db_session.execute(
        select(User).where(User.email == "pwreset@example.com")
    )
    user = result.scalar_one()
    user.email_verified = True
    await db_session.commit()

    with patch(EMAIL_PATCH) as mock_send:
        resp = await client.post(
            "/auth/forgot-password",
            json={"email": "pwreset@example.com"},
        )
    assert resp.status_code == 200
    mock_send.assert_called_once()


# ── Verify reset token ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_reset_token_valid(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    with patch(EMAIL_PATCH):
        await client.post(
            "/auth/register",
            json={"email": "checktoken@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    result = await db_session.execute(
        select(User).where(User.email == "checktoken@example.com")
    )
    user = result.scalar_one()
    user.email_verified = True
    await db_session.commit()

    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(EMAIL_PATCH, side_effect=_capture):
        await client.post(
            "/auth/forgot-password",
            json={"email": "checktoken@example.com"},
        )

    import re
    match = re.search(r"token=([A-Za-z0-9_\-]+)", captured[0]["html"])
    raw_token = match.group(1)

    resp = await client.get(f"/auth/verify-reset-token?token={raw_token}")
    assert resp.status_code == 200

    # Token should still be usable (not consumed by verify)
    resp2 = await client.get(f"/auth/verify-reset-token?token={raw_token}")
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_verify_reset_token_invalid(client: AsyncClient) -> None:
    resp = await client.get("/auth/verify-reset-token?token=badtoken")
    assert resp.status_code == 400


# ── Reset password ────────────────────────────────────────────────────────────


async def _setup_reset_flow(
    client: AsyncClient, db_session: AsyncSession, email: str
) -> str:
    """Register, verify, request reset, return raw reset token."""
    with patch(EMAIL_PATCH):
        await client.post(
            "/auth/register",
            json={"email": email, "password": "old-password-123", "plan_name": "free"},
        )

    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    user.email_verified = True
    await db_session.commit()

    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(EMAIL_PATCH, side_effect=_capture):
        await client.post("/auth/forgot-password", json={"email": email})

    import re
    match = re.search(r"token=([A-Za-z0-9_\-]+)", captured[0]["html"])
    return match.group(1)


@pytest.mark.asyncio
async def test_reset_password_success(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    raw_token = await _setup_reset_flow(
        client, db_session, "dopassreset@example.com"
    )

    resp = await client.post(
        "/auth/reset-password",
        json={"token": raw_token, "password": "new-password-456"},
    )
    assert resp.status_code == 200
    assert "reset" in resp.json()["message"].lower()

    # New password works
    login_resp = await client.post(
        "/auth/login",
        json={"email": "dopassreset@example.com", "password": "new-password-456"},
    )
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_old_password_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    raw_token = await _setup_reset_flow(
        client, db_session, "oldpw@example.com"
    )

    await client.post(
        "/auth/reset-password",
        json={"token": raw_token, "password": "new-password-456"},
    )

    login_resp = await client.post(
        "/auth/login",
        json={"email": "oldpw@example.com", "password": "old-password-123"},
    )
    assert login_resp.status_code == 401


@pytest.mark.asyncio
async def test_reset_password_invalidates_sessions(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """token_version bump should invalidate any session cookie set before reset."""
    raw_token = await _setup_reset_flow(
        client, db_session, "sessionkill@example.com"
    )

    await client.post(
        "/auth/login",
        json={"email": "sessionkill@example.com", "password": "old-password-123"},
    )

    # Session cookie is now set; /me should work
    me_before = await client.get("/auth/me")
    assert me_before.status_code == 200

    await client.post(
        "/auth/reset-password",
        json={"token": raw_token, "password": "new-password-456"},
    )

    # Old session cookie should be rejected after token_version bump
    me_after = await client.get("/auth/me")
    assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_reset_password_token_cannot_be_reused(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    raw_token = await _setup_reset_flow(
        client, db_session, "reusepw@example.com"
    )

    r1 = await client.post(
        "/auth/reset-password",
        json={"token": raw_token, "password": "new-password-456"},
    )
    assert r1.status_code == 200

    r2 = await client.post(
        "/auth/reset-password",
        json={"token": raw_token, "password": "another-password-789"},
    )
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/reset-password",
        json={"token": "badtoken", "password": "newpassword123"},
    )
    assert resp.status_code == 400


# ── Upload blocked for unverified users ──────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_blocked_when_email_unverified(
    client: AsyncClient,
) -> None:
    with patch(EMAIL_PATCH):
        await client.post(
            "/auth/register",
            json={"email": "noupload@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    await client.post(
        "/auth/login",
        json={"email": "noupload@example.com", "password": "secure-pass-123"},
    )

    resp = await client.post(
        "/files/request-upload",
        json={"filename": "test.txt", "size_bytes": 100, "content_type": "text/plain"},
    )
    assert resp.status_code == 403
    assert "verification" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_allowed_after_verification(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    captured: list[dict] = []

    def _capture(params: dict) -> None:
        captured.append(params)

    with patch(EMAIL_PATCH, side_effect=_capture):
        await client.post(
            "/auth/register",
            json={"email": "canupload@example.com", "password": "secure-pass-123", "plan_name": "free"},
        )

    import re
    match = re.search(r"token=([A-Za-z0-9_\-]+)", captured[0]["html"])
    raw_token = match.group(1)

    await client.get(f"/auth/verify-email?token={raw_token}")

    await client.post(
        "/auth/login",
        json={"email": "canupload@example.com", "password": "secure-pass-123"},
    )

    with patch("app.services.storage_service.generate_presigned_put", return_value="http://minio/presigned"):
        resp = await client.post(
            "/files/request-upload",
            json={"filename": "test.txt", "size_bytes": 100, "content_type": "text/plain"},
        )
    assert resp.status_code == 201
