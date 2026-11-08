"""Queries that feed the risk trend (services/scoring/trend.py).

Basically a helper module to grab commits during a given time frame.
"""

import datetime
import uuid

from sqlalchemy import Date, Float, cast, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.services.scoring.ownership import HALF_LIFE_DAYS
from src.services.scoring.trend import (
    WEIGHT_REFERENCE,
    MonthlyContribution,
    MonthlyLastChange,
)


def _commit_month():
    """SQL expression: first day of the commit's month, in UTC."""
    return cast(func.date_trunc("month", func.timezone("UTC", Commit.committed_at)), Date)


def _bucket(since: datetime.date | None):
    """SQL expression for grouping commits by month. With `since`, every month
    before it is grouped into `since` itself, so history before a window comes
    back as one row per file and author instead of one per month. Cumulative
    totals stay correct; see trend.score_trend."""
    if since is None:
        return _commit_month()
    return func.greatest(_commit_month(), literal(since, Date))


async def get_latest_commit_month(db: AsyncSession, repo_id: uuid.UUID) -> datetime.date | None:
    """First day of the month of the repo's latest commit, or None if it has none."""
    result = await db.execute(select(func.max(_commit_month())).where(Commit.repo_id == repo_id))
    return result.scalar()


def _recency_weight(half_life_days: float):
    """SQL expression: trend.recency_weight() of the commit's date, i.e.
    2 ^ (days since WEIGHT_REFERENCE / half-life)."""
    seconds_since_reference = (
        cast(func.extract("epoch", Commit.committed_at), Float) - WEIGHT_REFERENCE.timestamp()
    )
    half_life_seconds = cast(half_life_days * 86400, Float)
    return func.power(cast(2, Float), seconds_since_reference / half_life_seconds)


async def get_monthly_contributions(
    db: AsyncSession,
    repo_id: uuid.UUID,
    since: datetime.date | None = None,
    half_life_days: float = HALF_LIFE_DAYS,
) -> list[MonthlyContribution]:
    """Return lines added per (file, author, month), raw and recency-weighted.
    With `since`, earlier months are added into that month (see _bucket)."""
    month = _bucket(since)
    result = await db.execute(
        select(
            FileChange.file_path,
            Commit.author_email,
            Commit.author_name,
            month.label("month"),
            func.sum(FileChange.lines_added).label("lines_added"),
            func.sum(FileChange.lines_added * _recency_weight(half_life_days)).label("weighted_lines"),
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
            weighted_lines=row.weighted_lines or 0.0,
        )
        for row in result
    ]


async def get_monthly_last_changes(
    db: AsyncSession, repo_id: uuid.UUID, since: datetime.date | None = None
) -> list[MonthlyLastChange]:
    """Return each file's last change type in every month it was changed.
    With `since`, earlier months are grouped into that month (see _bucket)."""
    month = _bucket(since)
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
    db: AsyncSession, repo_id: uuid.UUID, since: datetime.date | None = None
) -> dict[datetime.date, int]:
    """Return {first day of month: number of commits} for months with commits.
    With `since`, earlier commits are counted in that month (see _bucket)."""
    month = _bucket(since)
    result = await db.execute(
        select(month.label("month"), func.count(Commit.id).label("commits"))
        .where(Commit.repo_id == repo_id)
        .group_by(month)
    )
    return {row.month: row.commits for row in result}
