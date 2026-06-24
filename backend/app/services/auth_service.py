import logging
from datetime import UTC, datetime
from typing import Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import RegistrationError, ValidationError
from app.core.password_blocklist import is_blocklisted
from app.core.security import DUMMY_HASH, hash_password
from app.models.plan import Plan
from app.models.user import User
from app.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

PlanName = Literal["free", "pro_10"]

_hasher = PasswordHasher()


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        plan_name=user.plan.name,
        quota_bytes=user.plan.quota_bytes,
        used_bytes=user.used_bytes,
        email_verified=user.email_verified,
    )


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    plan_name: PlanName,
) -> User:
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")

    if is_blocklisted(password):
        raise ValidationError("Password is too common")

    plan = await db.scalar(select(Plan).where(Plan.name == plan_name))
    if plan is None:
        raise ValidationError("Invalid plan")

    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        plan_id=plan.id,
        used_bytes=0,
        token_version=1,
        email_verified=False,
        failed_login_attempts=0,
    )

    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Generic message prevents email enumeration.
        raise RegistrationError("Registration failed")

    user = await db.scalar(
        select(User).options(selectinload(User.plan)).where(User.id == user.id)
    )
    if user is None:
        raise RegistrationError("Registration failed")

    logger.info("user_registered user_id=%s", user.id)
    return user


async def authenticate_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
) -> User | None:
    result = await db.execute(
        select(User)
        .options(selectinload(User.plan))
        .where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Timing equalization: argon2 verify dominates login latency. Running
        # verify against a fixed sentinel hash ensures unknown-email and
        # wrong-password paths take similar wall-clock time, closing a side
        # channel that would otherwise leak whether an email is registered.
        try:
            _hasher.verify(DUMMY_HASH, password)
        except VerifyMismatchError:
            pass
        return None

    try:
        _hasher.verify(user.password_hash, password)
    except VerifyMismatchError:
        user.failed_login_attempts += 1
        user.last_failed_login_at = datetime.now(UTC)
        await db.commit()
        logger.info("login_failed user_id=%s", user.id)
        return None

    user.failed_login_attempts = 0
    await db.commit()
    logger.info("login_success user_id=%s", user.id)
    return user
