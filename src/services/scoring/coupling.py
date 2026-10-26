import uuid
from datetime import datetime, UTC

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.db.models.file_coupling import FileCoupling


# ── Query builders (pure functions, return SQLAlchemy selectables) ──────


def _repo_commit_ids(repo_id: uuid.UUID):
    """Subquery: all commit IDs belonging to a repo."""
    return (
        select(Commit.id)
        .where(Commit.repo_id == repo_id)
        .subquery("repo_commits")
    )


def _co_occurrence_pairs(repo_commit_sq, min_co_commits: int):
    """Subquery: file pairs that appear in the same commit >= min_co_commits times."""
    fc1 = FileChange.__table__.alias("fc1")
    fc2 = FileChange.__table__.alias("fc2")
    return (
        select(
            fc1.c.file_path.label("file_a"),
            fc2.c.file_path.label("file_b"),
            func.count(func.distinct(fc1.c.commit_id)).label("co_commit_count"),
        )
        .select_from(fc1)
        .join(fc2, (fc1.c.commit_id == fc2.c.commit_id) & (fc1.c.file_path < fc2.c.file_path))
        .where(fc1.c.commit_id.in_(select(repo_commit_sq.c.id)))
        .group_by(fc1.c.file_path, fc2.c.file_path)
        .having(func.count(func.distinct(fc1.c.commit_id)) >= min_co_commits)
        .subquery("co_pairs")
    )


def _file_total_commits(repo_commit_sq):
    """Subquery: how many distinct commits each file appears in."""
    return (
        select(
            FileChange.file_path,
            func.count(func.distinct(FileChange.commit_id)).label("total_commits"),
        )
        .where(FileChange.commit_id.in_(select(repo_commit_sq.c.id)))
        .group_by(FileChange.file_path)
        .subquery("file_totals")
    )


# ── Score calculation (pure function) ──────────────────────────────────


def _build_upsert_values(rows, repo_id: uuid.UUID) -> list[dict]:
    """Convert raw query rows into dicts with a computed coupling_score."""
    now = datetime.now(UTC)
    return [
        {
            "id": uuid.uuid4(),
            "repo_id": repo_id,
            "file_a": row.file_a,
            "file_b": row.file_b,
            "co_commit_count": row.co_commit_count,
            "total_commits_a": row.total_commits_a,
            "total_commits_b": row.total_commits_b,
            "coupling_score": row.co_commit_count / max(row.total_commits_a, row.total_commits_b),
            "updated_at": now,
        }
        for row in rows
    ]


# ── Orchestrator (the only async function that touches the DB) ─────────


async def compute_couplings(
    db: AsyncSession,
    repo_id: uuid.UUID,
    min_co_commits: int = 2,
) -> None:
    """Compute co-change coupling scores for all file pairs in a repo."""

    # 1. Build subqueries
    repo_commit_sq = _repo_commit_ids(repo_id)
    co_pairs = _co_occurrence_pairs(repo_commit_sq, min_co_commits)
    file_totals = _file_total_commits(repo_commit_sq)

    # 2. Join pairs with per-file totals
    ft_a = file_totals.alias("ft_a")
    ft_b = file_totals.alias("ft_b")
    query = (
        select(
            co_pairs.c.file_a,
            co_pairs.c.file_b,
            co_pairs.c.co_commit_count,
            ft_a.c.total_commits.label("total_commits_a"),
            ft_b.c.total_commits.label("total_commits_b"),
        )
        .join(ft_a, co_pairs.c.file_a == ft_a.c.file_path)
        .join(ft_b, co_pairs.c.file_b == ft_b.c.file_path)
    )

    # 3. Execute and score
    rows = (await db.execute(query)).all()
    if not rows:
        return
    values = _build_upsert_values(rows, repo_id)

    # 4. Upsert into file_couplings
    stmt = pg_insert(FileCoupling).values(values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_coupling_pair",
        set_={
            "co_commit_count": stmt.excluded.co_commit_count,
            "total_commits_a": stmt.excluded.total_commits_a,
            "total_commits_b": stmt.excluded.total_commits_b,
            "coupling_score": stmt.excluded.coupling_score,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    await db.execute(stmt)
    await db.flush()
