"""Queries that feed the risk trend (services/scoring/trend.py).

Basically a helper module to grab commits during a given time frame.
"""

import datetime
import uuid

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.services.scoring.trend import MonthlyContribution, MonthlyLastChange


def _commit_month():
    """SQL expression: first day of the commit's month, in UTC."""
    return cast(func.date_trunc("month", func.timezone("UTC", Commit.committed_at)), Date)


async def get_monthly_contributions(
    db: AsyncSession, repo_id: uuid.UUID
) -> list[MonthlyContribution]:
    """Return lines added per (file, author, month)."""
    month = _commit_month()
    result = await db.execute(
        select(
            FileChange.file_path,
            Commit.author_email,
            Commit.author_name,
            month.label("month"),
            func.sum(FileChange.lines_added).label("lines_added"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(Commit.repo_id == repo_id)
        .group_by(FileChange.file_path, Commit.author_email, Commit.author_name, month)
    )
    return [
        MonthlyContribution(
            month=row.month,
            file_path=row.file_path,
            author_email=row.author_email,
            author_name=row.author_name,
            lines_added=row.lines_added or 0,
        )
        for row in result
    ]


async def get_monthly_last_changes(
    db: AsyncSession, repo_id: uuid.UUID
) -> list[MonthlyLastChange]:
    """Return each file's last change type in every month it was changed."""
    month = _commit_month()
    # Number each file's changes within a month from newest (1) to oldest.
    changes = (
        select(
            FileChange.file_path,
            FileChange.change_type,
            month.label("month"),
            func.row_number()
            .over(
                partition_by=(FileChange.file_path, month),
                order_by=Commit.committed_at.desc(),
            )
            .label("recency"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(Commit.repo_id == repo_id)
        .subquery()
    )
    result = await db.execute(
        select(changes.c.file_path, changes.c.change_type, changes.c.month).where(
            changes.c.recency == 1
        )
    )
    return [
        MonthlyLastChange(month=row.month, file_path=row.file_path, change_type=row.change_type)
        for row in result
    ]


async def get_commits_per_month(
    db: AsyncSession, repo_id: uuid.UUID
) -> dict[datetime.date, int]:
    """Return {first day of month: number of commits} for months with commits."""
    month = _commit_month()
    result = await db.execute(
        select(month.label("month"), func.count(Commit.id).label("commits"))
        .where(Commit.repo_id == repo_id)
        .group_by(month)
    )
    return {row.month: row.commits for row in result}
