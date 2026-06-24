import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import SESSION_COOKIE_NAME
from app.models.user import User
from tests.conftest import login_and_get_cookie


@pytest.mark.asyncio
async def test_register_succeeds(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == register_payload["email"]
    assert data["plan_name"] == "free"
    assert data["used_bytes"] == 0
    assert data["email_verified"] is False
    assert "quota_bytes" in data


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    await client.post("/auth/register", json=register_payload)
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "Registration failed"
    assert register_payload["email"] not in response.text


@pytest.mark.asyncio
async def test_register_rejects_short_password(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    register_payload["password"] = "short"
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_blocklisted_password(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    register_payload["password"] = "password123"
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Password is too common"


@pytest.mark.asyncio
async def test_register_rejects_invalid_plan_name(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    register_payload["plan_name"] = "enterprise"
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_succeeds_and_sets_httponly_cookie(
    client: AsyncClient,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    response = await client.post(
        "/auth/login",
        json={
            "email": register_payload["email"],
            "password": register_payload["password"],
        },
    )
    assert response.status_code == 200
    assert SESSION_COOKIE_NAME in response.cookies
    set_cookie = response.headers.get("set-cookie", "")
    assert "httponly" in set_cookie.lower()


@pytest.mark.asyncio
async def test_login_fails_wrong_password(
    client: AsyncClient,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    response = await client.post(
        "/auth/login",
        json={"email": register_payload["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_fails_nonexistent_email(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "some-password"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["detail"] == "Invalid credentials"
    assert "nobody@example.com" not in response.text


@pytest.mark.asyncio
async def test_login_failure_and_success_response_shape_match(
    client: AsyncClient,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    wrong = await client.post(
        "/auth/login",
        json={"email": register_payload["email"], "password": "wrong-password"},
    )
    missing = await client.post(
        "/auth/login",
        json={"email": "missing@example.com", "password": "wrong-password"},
    )
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json().keys() == missing.json().keys()


@pytest.mark.asyncio
async def test_login_increments_failed_attempts_on_failure(
    client: AsyncClient,
    db_session,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    await client.post(
        "/auth/login",
        json={"email": register_payload["email"], "password": "wrong-password"},
    )
    user = await db_session.scalar(
        select(User).where(User.email == register_payload["email"])
    )
    assert user is not None
    assert user.failed_login_attempts == 1
    assert user.last_failed_login_at is not None


@pytest.mark.asyncio
async def test_login_resets_failed_attempts_on_success(
    client: AsyncClient,
    db_session,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    await client.post(
        "/auth/login",
        json={"email": register_payload["email"], "password": "wrong-password"},
    )
    await client.post(
        "/auth/login",
        json={
            "email": register_payload["email"],
            "password": register_payload["password"],
        },
    )
    user = await db_session.scalar(
        select(User).where(User.email == register_payload["email"])
    )
    assert user is not None
    assert user.failed_login_attempts == 0


@pytest.mark.asyncio
async def test_me_returns_401_without_cookie(client: AsyncClient) -> None:
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_with_valid_cookie(
    client: AsyncClient,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    cookie = await login_and_get_cookie(
        client,
        register_payload["email"],
        register_payload["password"],
    )
    client.cookies.set(SESSION_COOKIE_NAME, cookie)
    response = await client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == register_payload["email"]


@pytest.mark.asyncio
async def test_logout_clears_cookie_and_increments_token_version(
    client: AsyncClient,
    db_session,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    cookie = await login_and_get_cookie(
        client,
        register_payload["email"],
        register_payload["password"],
    )
    client.cookies.set(SESSION_COOKIE_NAME, cookie)

    user_before = await db_session.scalar(
        select(User).where(User.email == register_payload["email"])
    )
    assert user_before is not None
    version_before = user_before.token_version

    response = await client.post("/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out"

    user_after = await db_session.scalar(
        select(User).where(User.email == register_payload["email"])
    )
    assert user_after is not None
    assert user_after.token_version == version_before + 1


@pytest.mark.asyncio
async def test_logout_invalidates_old_cookie(
    client: AsyncClient,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    cookie = await login_and_get_cookie(
        client,
        register_payload["email"],
        register_payload["password"],
    )
    client.cookies.set(SESSION_COOKIE_NAME, cookie)
    await client.post("/auth/logout")

    client.cookies.set(SESSION_COOKIE_NAME, cookie)
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_rate_limiter_blocks_sixth_login_attempt(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    unique_email = f"ratelimit-{uuid.uuid4()}@example.com"
    payload = {**register_payload, "email": unique_email}
    await client.post("/auth/register", json=payload)

    login_body = {"email": unique_email, "password": "wrong-password"}
    for _ in range(5):
        response = await client.post("/auth/login", json=login_body)
        assert response.status_code == 401

    sixth = await client.post("/auth/login", json=login_body)
    assert sixth.status_code == 429


@pytest.mark.asyncio
async def test_login_nonexistent_email_does_not_increment_attempts(
    client: AsyncClient,
    db_session,
    registered_user: dict,
    register_payload: dict[str, str],
) -> None:
    await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "some-password"},
    )
    user = await db_session.scalar(
        select(User).where(User.email == register_payload["email"])
    )
    assert user is not None
    assert user.failed_login_attempts == 0


@pytest.mark.asyncio
async def test_me_rejects_malformed_jwt(client: AsyncClient) -> None:
    client.cookies.set(SESSION_COOKIE_NAME, "not-a-jwt-at-all")
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_rate_limit(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> None:
    for i in range(5):
        payload = {
            **register_payload,
            "email": f"ratelimit-reg-{i}-{uuid.uuid4()}@example.com",
        }
        response = await client.post("/auth/register", json=payload)
        assert response.status_code == 201

    sixth_payload = {
        **register_payload,
        "email": f"ratelimit-reg-6-{uuid.uuid4()}@example.com",
    }
    sixth = await client.post("/auth/register", json=sixth_payload)
    assert sixth.status_code == 429
