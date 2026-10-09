"""create repos commits file_changes tables

Revision ID: 3d454f85bb91
Revises: 
Create Date: 2026-10-07 14:09:19.847413

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d454f85bb91'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the repos, commits, and file_changes tables."""
    op.create_table(
        "repos",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.String, unique=True, nullable=False),
        sa.Column("local_path", sa.String, nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "commits",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "repo_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sha", sa.String(40), nullable=False, index=True),
        sa.Column("author_name", sa.String, nullable=False),
        sa.Column("author_email", sa.String, nullable=False),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("insertions", sa.Integer, default=0),
        sa.Column("deletions", sa.Integer, default=0),
    )

    op.create_table(
        "file_changes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "commit_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("commits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_path", sa.String, nullable=False),
        sa.Column("old_path", sa.String, nullable=True),
        sa.Column("change_type", sa.String(10), nullable=False),
        sa.Column("lines_added", sa.Integer, default=0),
        sa.Column("lines_removed", sa.Integer, default=0),
    )


def downgrade() -> None:
    """Drop the file_changes, commits, and repos tables."""
    op.drop_table("file_changes")
    op.drop_table("commits")
    op.drop_table("repos")
