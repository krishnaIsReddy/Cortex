"""Queries that feed ownership scoring and the dashboard."""

import uuid

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


async def get_contributions(db: AsyncSession, repo_id: uuid.UUID) -> list[Contribution]:
    """Return lines added per (file, author) for files that still exist.

    A file counts as deleted when its most recent change is a DELETE.
    Limitation: a renamed file's history under its old path is not merged in.
    """
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
    deleted_paths = select(latest_change.c.file_path).where(
        latest_change.c.recency == 1,
        latest_change.c.change_type == "DELETE",
    )

    # Total lines added per file, per author (name + email).
    result = await db.execute(
        select(
            FileChange.file_path,
            Commit.author_email,
            Commit.author_name,
            func.sum(FileChange.lines_added).label("lines_added"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(
            Commit.repo_id == repo_id,
            FileChange.file_path.not_in(deleted_paths),
        )
        .group_by(FileChange.file_path, Commit.author_email, Commit.author_name)
    )

    return [
        Contribution(
            file_path=row.file_path,
            author_email=row.author_email,
            author_name=row.author_name,
            lines_added=row.lines_added or 0,
        )
        for row in result
    ]
