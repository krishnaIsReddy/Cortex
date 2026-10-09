import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


class FileChange(Base):
    __tablename__ = "file_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    commit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("commits.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    old_path: Mapped[str | None] = mapped_column(String, nullable=True)
    change_type: Mapped[str] = mapped_column(String(10), nullable=False)
    lines_added: Mapped[int] = mapped_column(Integer, default=0)
    lines_removed: Mapped[int] = mapped_column(Integer, default=0)

    commit: Mapped["Commit"] = relationship("Commit", back_populates="file_changes")

    def __repr__(self) -> str:
        """Return a short string showing the changed file path."""
        return f"<FileChange {self.file_path}>"
