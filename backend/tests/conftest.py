import os

# Must be set before any app imports so pydantic-settings picks them up.
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://filevault:changeme@localhost:5432/filevault_test",
    ),
)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-with-at-least-32-bytes!!",
)
os.environ.setdefault("S3_ENDPOINT_URL", "http://localhost:9000")
os.environ.setdefault("S3_BUCKET", "file-vault")
os.environ.setdefault("S3_REGION", "us-east-1")
os.environ.setdefault("S3_ACCESS_KEY_ID", "minioadmin")
os.environ.setdefault("S3_SECRET_ACCESS_KEY", "minioadmin123")
os.environ["RESEND_API_KEY"] = os.environ.get("RESEND_API_KEY") or "test-resend-key"
os.environ.setdefault("EMAIL_FROM", "test@example.com")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

import uuid
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import SESSION_COOKIE_NAME
from app.main import app as fastapi_app
from app.models.base import Base

import app.models  # noqa: F401

TEST_ENGINE = create_async_engine(
    os.environ["DATABASE_URL"],
    pool_pre_ping=True,
    poolclass=NullPool,
)

_schema_ready = False


async def _ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    async with TEST_ENGINE.begin() as conn:
        # Drop and recreate so the schema always matches the current models.
        # Safe because tests roll back every transaction; no persistent data.
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "INSERT INTO plans (id, name, quota_bytes) VALUES "
                "(:free_id, 'free', 104857600), "
                "(:pro_id, 'pro_10', 10737418240) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {"free_id": uuid.uuid4(), "pro_id": uuid.uuid4()},
        )
    _schema_ready = True


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    yield
    storage = getattr(limiter, "_storage", None)
    if storage is not None and hasattr(storage, "storage"):
        storage.storage.clear()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    await _ensure_schema()
    async with TEST_ENGINE.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def register_payload() -> dict[str, str]:
    return {
        "email": "user@example.com",
        "password": "unique-password-123",
        "plan_name": "free",
        "full_name": "Test User",
    }


@pytest.fixture
async def registered_user(
    client: AsyncClient,
    register_payload: dict[str, str],
) -> dict:
    response = await client.post("/auth/register", json=register_payload)
    assert response.status_code == 201
    return response.json()


async def login_and_get_cookie(
    client: AsyncClient,
    email: str,
    password: str,
) -> str:
    response = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    cookie = response.cookies.get(SESSION_COOKIE_NAME)
    assert cookie is not None
    return cookie
