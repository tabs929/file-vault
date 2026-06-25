"""add verification_tokens table

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-24

Adds verification_tokens table used for email verification and password reset.
Tokens are stored as SHA-256 hashes; the raw token is never persisted.
ON DELETE CASCADE ensures rows are removed when the parent user is deleted.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "verification_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("token_type", sa.String(50), nullable=False),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "used_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_verification_tokens_user_id ON verification_tokens (user_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_verification_tokens_user_id")
    op.drop_table("verification_tokens")
