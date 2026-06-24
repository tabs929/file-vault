"""
Seed default subscription plans into the database.

Usage (from the backend/ directory):
    uv run python -m scripts.seed_plans

Or inside the running api container:
    docker compose exec api uv run python -m scripts.seed_plans

Idempotency:
    Uses INSERT ... ON CONFLICT (name) DO NOTHING.
    Re-running this script is safe — it will not overwrite existing rows.

Changing quotas for existing plans:
    Re-running this script will NOT update existing plan quotas.
    To change a quota, run a manual SQL UPDATE:

        UPDATE plans SET quota_bytes = <new_value> WHERE name = '<plan_name>';
"""

import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal

PLANS: list[dict[str, object]] = [
    {"name": "free", "quota_bytes": 104_857_600},       # 100 MiB
    {"name": "pro_10", "quota_bytes": 10_737_418_240},  # 10 GiB
]


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        for plan in PLANS:
            await session.execute(
                text(
                    "INSERT INTO plans (id, name, quota_bytes) "
                    "VALUES (gen_random_uuid(), :name, :quota_bytes) "
                    "ON CONFLICT (name) DO NOTHING"
                ),
                plan,
            )
        await session.commit()

    for plan in PLANS:
        print(f"  ✓ {plan['name']} ({plan['quota_bytes']:,} bytes)")
    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())
