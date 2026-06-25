revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NOT NULL DEFAULT ''")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS full_name")
