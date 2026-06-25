#!/usr/bin/env python3
"""
Reconcile user quota used_bytes with actual confirmed file sizes.

Usage:
    DATABASE_URL=postgresql+asyncpg://... python scripts/reconcile_quota.py

Actions:
1. For each user: print current used_bytes vs SUM(size_bytes) of confirmed files.
2. Update used_bytes to match the actual sum where they differ.
3. Delete pending file records older than 1 hour (stranded uploads).
4. Print a summary of what changed.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.file import File  # noqa: E402
from app.models.user import User  # noqa: E402


async def reconcile() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set.", flush=True)
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        # Delete stranded pending uploads older than 1 hour.
        cutoff = datetime.utcnow() - timedelta(hours=1)
        deleted_result = await db.execute(
            delete(File)
            .where(File.upload_status == "pending", File.created_at < cutoff)
            .returning(File.id)
        )
        deleted_count = len(deleted_result.fetchall())

        # Compute actual confirmed bytes per user.
        agg_result = await db.execute(
            select(
                File.owner_id,
                func.coalesce(func.sum(File.size_bytes), 0).label("actual"),
            )
            .where(File.upload_status == "confirmed")
            .group_by(File.owner_id)
        )
        actual_by_user: dict = {row.owner_id: int(row.actual) for row in agg_result}

        # Load all users and reconcile.
        users_result = await db.execute(select(User))
        users = list(users_result.scalars().all())

        fixed_count = 0
        for user in users:
            actual = actual_by_user.get(user.id, 0)
            if user.used_bytes != actual:
                print(
                    f"  {user.email}: used_bytes={user.used_bytes} → {actual} "
                    f"(delta {actual - user.used_bytes:+d})",
                    flush=True,
                )
                user.used_bytes = actual
                fixed_count += 1

        await db.commit()

    await engine.dispose()

    print(f"\nReconciliation complete:", flush=True)
    print(f"  Users with corrected quota:       {fixed_count}", flush=True)
    print(f"  Stranded pending records deleted: {deleted_count}", flush=True)


if __name__ == "__main__":
    asyncio.run(reconcile())
