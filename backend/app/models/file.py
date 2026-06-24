import uuid

from sqlalchemy import BigInteger, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import TimestampMixin


class File(TimestampMixin, Base):
    __tablename__ = "files"

    # Composite index for efficient per-owner file listing ordered by recency.
    # The DESC direction is declared in the Alembic migration (0001_initial_schema)
    # because SQLAlchemy's __table_args__ string-column syntax does not support
    # sort direction. A future --autogenerate diff is expected here; resolve by
    # inspecting and squashing when needed.
    __table_args__ = (
        Index("ix_files_owner_id_created_at", "owner_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        index=True,
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    upload_status: Mapped[str] = mapped_column(
        String,
        server_default=text("'pending'"),
        nullable=False,
    )
