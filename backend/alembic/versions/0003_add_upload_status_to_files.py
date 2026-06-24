"""add upload_status to files

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-24

Adds upload_status column to files table.
Values: 'pending' (upload initiated, not yet verified in S3)
        'confirmed' (object verified in S3, used_bytes committed)
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "files",
        sa.Column(
            "upload_status",
            sa.String(),
            server_default="pending",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("files", "upload_status")
