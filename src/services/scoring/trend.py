"""Risk trend: how a repo's share of high-risk files changed month by month.

For each month, files are scored with the same `score_files()` the dashboard
uses, over all history up to the end of that month. So the latest point always
matches the current risk report.

Inputs are per-month totals (see db/repositories/trend_repository.py) rather
than raw commits, so long histories stay quick to score.

Known limitations (the same as the risk report's):
  - A renamed file's history under its old path is not merged in.
  - A file counts as deleted when its latest change (so far) is a DELETE.

Pure Python (no database, no web code), like ownership.py.
"""

import datetime
from collections import defaultdict
from dataclasses import dataclass

from src.services.scoring.ownership import Contribution, score_files

# A file is high-risk at or above this score: the same cutoff as the
# dashboard's "High" level (src/frontend/src/components/dashboard/riskLevels.js).
HIGH_RISK_THRESHOLD = 0.7


@dataclass(frozen=True)
class MonthlyContribution:
    """Lines one author added to one file during one month."""

    month: datetime.date  # first day of the month (UTC)
    file_path: str
    author_email: str
    author_name: str
    lines_added: int


@dataclass(frozen=True)
class MonthlyLastChange:
    """The last change made to a file during one month."""

    month: datetime.date  # first day of the month (UTC)
    file_path: str
    change_type: str  # e.g. "ADD", "MODIFY", "DELETE", "RENAME"


@dataclass(frozen=True)
class TrendPoint:
    """The repo's risk at the end of one month."""

    period_end: datetime.date  # last day of the month
    high_risk_share: float  # 0 to 1; 0 when no files are scored yet
    high_risk_file_count: int
    file_count: int
    commit_count: int  # commits up to and including this month


def month_end(month: datetime.date) -> datetime.date:
    """Last day of the month, e.g. 2026-02-01 -> 2026-02-28."""
    next_month = next_month_start(month)
    return next_month - datetime.timedelta(days=1)


def next_month_start(month: datetime.date) -> datetime.date:
    """First day of the following month, e.g. 2026-12-01 -> 2027-01-01."""
    if month.month == 12:
        return datetime.date(month.year + 1, 1, 1)
    return datetime.date(month.year, month.month + 1, 1)


def months_before(month: datetime.date, count: int) -> datetime.date:
    """The month `count` months earlier, e.g. (2026-03-01, 4) -> 2025-11-01."""
    index = month.year * 12 + (month.month - 1) - count
    return datetime.date(index // 12, index % 12 + 1, 1)


def score_trend(
    contributions: list[MonthlyContribution],
    last_changes: list[MonthlyLastChange],
    commits_per_month: dict[datetime.date, int],
    months: int | None = None,
) -> list[TrendPoint]:
    """Return one point per month, oldest first, from the month of the first
    commit to the month of the latest. Months without commits are included
    (with unchanged scores) so the chart's spacing is even.

    `months` keeps only the latest N months. Earlier history still counts
    towards every point; those months just aren't scored, which keeps long
    histories quick.

    Returns [] when the repo has no commits.
    """
    if not commits_per_month:
        return []

    contributions_by_month = defaultdict(list)
    for row in contributions:
        contributions_by_month[row.month].append(row)

    last_changes_by_month = defaultdict(list)
    for row in last_changes:
        last_changes_by_month[row.month].append(row)

    # Running totals, updated one month at a time.
    lines_so_far: dict[tuple[str, str, str], int] = defaultdict(int)  # (path, email, name) -> lines
    deleted_paths: set[str] = set()
    commit_count = 0

    points = []
    month = min(commits_per_month)
    last_month = max(commits_per_month)
    first_scored_month = month if months is None else max(month, months_before(last_month, months - 1))
    while month <= last_month:
        for row in contributions_by_month[month]:
            lines_so_far[(row.file_path, row.author_email, row.author_name)] += row.lines_added

        for row in last_changes_by_month[month]:
            if row.change_type == "DELETE":
                deleted_paths.add(row.file_path)
            else:
                deleted_paths.discard(row.file_path)  # re-added after a delete

        commit_count += commits_per_month.get(month, 0)

        if month < first_scored_month:
            month = next_month_start(month)
            continue

        files = score_files([
            Contribution(file_path=path, author_email=email, author_name=name, lines_added=lines)
            for (path, email, name), lines in lines_so_far.items()
            if path not in deleted_paths
        ])
        high_risk_count = sum(1 for file in files if file.risk_score >= HIGH_RISK_THRESHOLD)

        points.append(
            TrendPoint(
                period_end=month_end(month),
                high_risk_share=high_risk_count / len(files) if files else 0.0,
                high_risk_file_count=high_risk_count,
                file_count=len(files),
                commit_count=commit_count,
            )
        )
        month = next_month_start(month)

    return points
