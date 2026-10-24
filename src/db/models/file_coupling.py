import datetime
import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from . import Base


class FileCoupling(Base):
    __tablename__ = "file_couplings"
    __table_args__ = (
        UniqueConstraint("repo_id", "file_a", "file_b", name="uq_coupling_pair"),
        Index("ix_couplings_repo_score", "repo_id", "coupling_score"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    file_a: Mapped[str] = mapped_column(String, nullable=False)
    file_b: Mapped[str] = mapped_column(String, nullable=False)
    co_commit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_commits_a: Mapped[int] = mapped_column(Integer, nullable=False)
    total_commits_b: Mapped[int] = mapped_column(Integer, nullable=False)
    coupling_score: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    repo: Mapped["Repo"] = relationship("Repo")

    def __repr__(self) -> str:
        return f"<FileCoupling {self.file_a} <-> {self.file_b} score={self.coupling_score:.2f}>"
