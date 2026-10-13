import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


class Commit(Base):
    __tablename__ = "commits"
    __table_args__ = (
        UniqueConstraint("repo_id", "sha", name="uq_commits_repo_id_sha"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    sha: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    author_email: Mapped[str] = mapped_column(String, nullable=False)
    committed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    insertions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)

    repo: Mapped["Repo"] = relationship("Repo", back_populates="commits")
    file_changes: Mapped[list["FileChange"]] = relationship(
        "FileChange", back_populates="commit", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """Return a short string showing the first 8 characters of the commit SHA."""
        return f"<Commit {self.sha[:8]}>"
