import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token import VerificationToken


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Only the hash is persisted."""
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw)


async def create_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    token_type: str,
    expires_in_minutes: int,
) -> str:
    """Create a token and return the raw (unhashed) value.

    Deletes existing unused tokens of the same type for this user first,
    so only one active token per user per type exists at a time.
    Caller is responsible for committing the session.
    """
    await db.execute(
        delete(VerificationToken).where(
            VerificationToken.user_id == user_id,
            VerificationToken.token_type == token_type,
            VerificationToken.used_at.is_(None),
        )
    )

    raw, hashed = generate_token()
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)

    db.add(
        VerificationToken(
            user_id=user_id,
            token_hash=hashed,
            token_type=token_type,
            expires_at=expires_at,
        )
    )
    return raw


async def _lookup_token(
    db: AsyncSession,
    raw_token: str,
    token_type: str,
) -> VerificationToken | None:
    """Shared lookup: find a valid, unused, unexpired token by raw value."""
    hashed = _hash_token(raw_token)

    result = await db.execute(
        select(VerificationToken).where(
            VerificationToken.token_hash == hashed,
            VerificationToken.token_type == token_type,
            VerificationToken.used_at.is_(None),
        )
    )
    token = result.scalar_one_or_none()

    if token is None:
        return None

    # Timing-safe comparison guards against hash enumeration side channels.
    if not hmac.compare_digest(token.token_hash, hashed):
        return None

    now = datetime.now(UTC)
    expires = (
        token.expires_at
        if token.expires_at.tzinfo is not None
        else token.expires_at.replace(tzinfo=UTC)
    )
    if now > expires:
        return None

    return token


async def consume_token(
    db: AsyncSession,
    raw_token: str,
    token_type: str,
) -> VerificationToken | None:
    """Validate and mark token used. Returns the record or None if invalid/expired.

    Caller is responsible for committing the session.
    """
    token = await _lookup_token(db, raw_token, token_type)
    if token is None:
        return None

    token.used_at = datetime.now(UTC)
    return token


async def verify_token(
    db: AsyncSession,
    raw_token: str,
    token_type: str,
) -> VerificationToken | None:
    """Validate token WITHOUT marking it used. Used for pre-flight checks."""
    return await _lookup_token(db, raw_token, token_type)
