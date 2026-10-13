import datetime
import uuid

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    url: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    local_path: Mapped[str | None] = mapped_column(String, nullable=True)
    last_synced_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    commits: Mapped[list["Commit"]] = relationship(
        "Commit", back_populates="repo", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """Return a short string showing the repo URL."""
        return f"<Repo {self.url}>"
