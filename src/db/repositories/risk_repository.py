"""Queries that feed ownership scoring and the dashboard."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.db.models.repo import Repo
from src.services.scoring.ownership import Contribution


async def list_repos(db: AsyncSession) -> list[Repo]:
    """Return every ingested repo, most recently synced first."""
    result = await db.execute(
        select(Repo).order_by(Repo.last_synced_at.desc().nulls_last())
    )
    return list(result.scalars())


async def get_repo(db: AsyncSession, repo_id: uuid.UUID) -> Repo | None:
    """Look up a repo by ID, or return None if it does not exist."""
    return await db.get(Repo, repo_id)


async def delete_repo(db: AsyncSession, repo_id: uuid.UUID) -> bool:
    """Delete a repo; its commits and file changes are removed by the
    database's ON DELETE CASCADE. Returns False if the repo didn't exist."""
    result = await db.execute(delete(Repo).where(Repo.id == repo_id))
    await db.commit()
    return result.rowcount > 0


async def get_repo_stats(db: AsyncSession, repo_id: uuid.UUID) -> tuple[int, int]:
    """Return (commit count, distinct author count) for a repo.

    Authors are counted by lowercased email, matching how scoring groups them.
    """
    result = await db.execute(
        select(
            func.count(Commit.id),
            func.count(func.distinct(func.lower(Commit.author_email))),
        ).where(Commit.repo_id == repo_id)
    )
    commit_count, contributor_count = result.one()
    return commit_count, contributor_count


def _deleted_paths(repo_id: uuid.UUID):
    """Subquery of paths in the repo whose most recent change is a DELETE."""
    # Number each file's changes from newest (1) to oldest, to find its latest change.
    latest_change = (
        select(
            FileChange.file_path,
            FileChange.change_type,
            func.row_number()
            .over(partition_by=FileChange.file_path, order_by=Commit.committed_at.desc())
            .label("recency"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(Commit.repo_id == repo_id)
        .subquery()
    )
    return select(latest_change.c.file_path).where(
        latest_change.c.recency == 1,
        latest_change.c.change_type == "DELETE",
    )


async def get_contributions(db: AsyncSession, repo_id: uuid.UUID) -> list[Contribution]:
    """Return lines added per (file, commit) for files that still exist.

    One row per file per commit (not summed), because scoring weights each
    commit by its age. A file counts as deleted when its most recent change is
    a DELETE. Limitation: a renamed file's history under its old path is not
    merged in.
    """
    result = await db.execute(
        select(
            FileChange.file_path,
            FileChange.lines_added,
            Commit.author_email,
            Commit.author_name,
            Commit.committed_at,
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(
            Commit.repo_id == repo_id,
            FileChange.file_path.not_in(_deleted_paths(repo_id)),
        )
    )
    return [_to_contribution(row) for row in result]


@dataclass(frozen=True)
class FileCommit:
    """One commit that changed a file, for the file drill-down."""

    sha: str
    author_name: str
    author_email: str
    committed_at: datetime.datetime
    message: str
    change_type: str
    lines_added: int
    lines_removed: int


def _human_changes_to_file(repo_id: uuid.UUID, path: str):
    """WHERE conditions for changes to `path` in the repo, excluding bots.

    `path` uses "/" separators; history stored with Windows "\\" separators is
    matched too. Bots are excluded the same way as ownership.is_bot, so the
    drill-down's commits agree with its "last changed" date.
    """
    return (
        Commit.repo_id == repo_id,
        FileChange.file_path.in_({path, path.replace("/", "\\")}),
        Commit.author_name.not_like("%[bot]%"),
        Commit.author_email.not_like("%[bot]%"),
    )


async def count_file_commits(db: AsyncSession, repo_id: uuid.UUID, path: str) -> int:
    """Return how many (non-bot) commits changed `path`."""
    result = await db.execute(
        select(func.count())
        .select_from(FileChange)
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(*_human_changes_to_file(repo_id, path))
    )
    return result.scalar_one()


async def get_file_history(
    db: AsyncSession, repo_id: uuid.UUID, path: str, limit: int
) -> list[FileCommit]:
    """Return the `limit` newest (non-bot) commits that changed `path`."""
    result = await db.execute(
        select(
            Commit.sha,
            Commit.author_name,
            Commit.author_email,
            Commit.committed_at,
            Commit.message,
            FileChange.change_type,
            FileChange.lines_added,
            FileChange.lines_removed,
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(*_human_changes_to_file(repo_id, path))
        .order_by(Commit.committed_at.desc())
        .limit(limit)
    )
    return [
        FileCommit(
            sha=row.sha,
            author_name=row.author_name,
            author_email=row.author_email,
            committed_at=row.committed_at,
            message=row.message,
            change_type=row.change_type,
            lines_added=row.lines_added or 0,
            lines_removed=row.lines_removed or 0,
        )
        for row in result
    ]


def _to_contribution(row) -> Contribution:
    return Contribution(
        file_path=row.file_path,
        author_email=row.author_email,
        author_name=row.author_name,
        lines_added=row.lines_added or 0,
        committed_at=row.committed_at,
    )
