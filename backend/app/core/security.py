import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
# Argon2id chosen over bcrypt: memory-hard, resistant to GPU-based attacks,
# current OWASP recommendation. Library defaults used (time_cost=3,
# memory_cost=65536 KiB, parallelism=4, hash_len=32, salt_len=16).

_hasher = PasswordHasher()

# Pre-computed sentinel hash for login timing equalization (see auth_service).
# Generated once at import time from a fixed dummy password.
DUMMY_HASH: str = _hasher.hash("dummy-password-for-timing-equalization")


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


# ── JWT ───────────────────────────────────────────────────────────────────────
# Hardcoded algorithm whitelist defends against the "none" algorithm attack and
# algorithm confusion attacks. Never trust the alg field in the token header.
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
SESSION_COOKIE_NAME = "session"


def create_access_token(*, user_id: uuid.UUID, token_version: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "exp": now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "iat": now,
        "jti": str(uuid.uuid4()),
        "tv": token_version,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    # Signature verification happens server-side on EVERY protected request.
    # The client never verifies anything. Tampering breaks the HMAC signature.
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
    )


def session_cookie_max_age() -> int:
    return ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


def session_cookie_secure() -> bool:
    return settings.ENVIRONMENT == "production"
