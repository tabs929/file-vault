from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """
    Adds created_at and updated_at columns using DB-side defaults.

    - created_at: set once by the DB on INSERT via server_default=func.now()
    - updated_at: set on INSERT and refreshed by SQLAlchemy on ORM-level UPDATE
                  via onupdate=func.now()

    Note: raw SQL UPDATE statements bypass onupdate — they will not touch
    updated_at. This is acceptable for Phase 1 where all writes go through
    the ORM session.
    """

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
