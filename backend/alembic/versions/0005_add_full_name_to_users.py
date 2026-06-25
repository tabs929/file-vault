revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('full_name', sa.String(100), nullable=False, server_default=''),
    )


def downgrade() -> None:
    op.drop_column('users', 'full_name')
