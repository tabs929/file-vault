from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import QuotaExceededError
from app.models.user import User

# SELECT FOR UPDATE acquires a row-level lock on the user row.
# This prevents the TOCTOU race condition where two concurrent uploads
# both pass the quota check individually but together exceed the limit.
# The lock serializes concurrent uploads per user.


async def check_and_reserve_quota(
    db: AsyncSession,
    user_id: object,
    size_bytes: int,
) -> None:
    """Check quota and increment used_bytes atomically under a row lock.

    Raises QuotaExceededError if current_usage + size_bytes would exceed the plan quota.
    On success, used_bytes is incremented by size_bytes within the caller's transaction.
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
    user = result.scalar_one()

    if user.used_bytes + size_bytes > user.plan.quota_bytes:
        raise QuotaExceededError(
            f"Upload would exceed your storage quota of "
            f"{user.plan.quota_bytes} bytes. "
            f"Currently using {user.used_bytes} bytes."
        )

    user.used_bytes = user.used_bytes + size_bytes
