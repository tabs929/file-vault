import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import QuotaExceededError
from app.models.user import User

# SELECT FOR UPDATE acquires a row-level lock on the user row.
# This prevents the TOCTOU race condition where two concurrent uploads
# both pass the quota check individually but together exceed the limit.
# The lock serializes concurrent uploads per user.


async def check_quota(
    db: AsyncSession,
    user_id: uuid.UUID,
    size_bytes: int,
) -> User:
    """Check that current_usage + size_bytes would not exceed the plan quota.

    Raises QuotaExceededError if the check fails. Does NOT increment used_bytes —
    the caller must do that atomically at confirm time.
    Returns the locked User row.
    """
    # selectinload keeps plan in a separate SELECT so FOR UPDATE locks only the user row.
    # populate_existing=True overwrites the identity-map cache with the freshly-locked
    # row, preventing a stale used_bytes read that would defeat the serialization.
    result = await db.execute(
        select(User)
        .options(selectinload(User.plan))
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.plan is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no plan assigned.",
        )

    if user.used_bytes + size_bytes > user.plan.quota_bytes:
        raise QuotaExceededError(
            f"Upload would exceed your storage quota of "
            f"{user.plan.quota_bytes} bytes. "
            f"Currently using {user.used_bytes} bytes."
        )

    return user
