import uuid
from datetime import datetime, UTC

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.db.models.file_coupling import FileCoupling

# Postgres rejects statements with more than this many bind parameters.
PG_MAX_QUERY_PARAMS = 32767

# Leave headroom so we stay safely under the hard limit if columns grow
# or the driver adds a few extra binds.
_PARAM_HEADROOM_RATIO = 0.9

# Initial imports and other bulk commits add noise. Skip them when scoring.
MAX_FILES_PER_COMMIT = 50


# ── Query builders (pure functions, return SQLAlchemy selectables) ──────


def _deleted_paths(repo_id: uuid.UUID):
    """Paths in the repo whose most recent change is a DELETE.

    Matches the risk report so couplings never name files the file table
    has already dropped.
    """
    latest_change = (
        select(
            FileChange.file_path,
            FileChange.change_type,
            func.row_number()
            .over(
                partition_by=FileChange.file_path,
                order_by=Commit.committed_at.desc(),
            )
            .label("recency"),
        )
        .join(Commit, Commit.id == FileChange.commit_id)
        .where(Commit.repo_id == repo_id)
        .subquery("latest_change")
    )
    return select(latest_change.c.file_path).where(
        latest_change.c.recency == 1,
        latest_change.c.change_type == "DELETE",
    )


def _repo_commit_ids(repo_id: uuid.UUID, max_files_per_commit: int = MAX_FILES_PER_COMMIT):
    """Subquery: commit IDs in this repo that touch fewer than max_files_per_commit files."""
    file_counts = (
        select(
            FileChange.commit_id.label("commit_id"),
            func.count(func.distinct(FileChange.file_path)).label("file_count"),
        )
        .group_by(FileChange.commit_id)
        .subquery("file_counts")
    )
    return (
        select(Commit.id)
        .join(file_counts, file_counts.c.commit_id == Commit.id)
        .where(
            Commit.repo_id == repo_id,
            file_counts.c.file_count < max_files_per_commit,
        )
        .subquery("repo_commits")
    )


def _co_occurrence_pairs(repo_commit_sq, min_co_commits: int, deleted_paths):
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
        .where(
            fc1.c.commit_id.in_(select(repo_commit_sq.c.id)),
            fc1.c.file_path.not_in(deleted_paths),
            fc2.c.file_path.not_in(deleted_paths),
        )
        .group_by(fc1.c.file_path, fc2.c.file_path)
        .having(func.count(func.distinct(fc1.c.commit_id)) >= min_co_commits)
        .subquery("co_pairs")
    )


def _file_total_commits(repo_commit_sq, deleted_paths):
    """Subquery: how many distinct commits each file appears in."""
    return (
        select(
            FileChange.file_path,
            func.count(func.distinct(FileChange.commit_id)).label("total_commits"),
        )
        .where(
            FileChange.commit_id.in_(select(repo_commit_sq.c.id)),
            FileChange.file_path.not_in(deleted_paths),
        )
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


# ── Chunked upsert ─────────────────────────────────────────────────────


def _upsert_batch_size(num_columns: int) -> int:
    """Max rows per INSERT so bound params stay under Postgres' limit.

    Recalculates from column count so adding fields to FileCoupling
    automatically shrinks the batch instead of blowing past 32767.
    """
    if num_columns < 1:
        raise ValueError("num_columns must be >= 1")
    safe_limit = int(PG_MAX_QUERY_PARAMS * _PARAM_HEADROOM_RATIO)
    return max(1, safe_limit // num_columns)


async def _upsert_couplings(
    db: AsyncSession,
    values: list[dict],
    batch_size: int | None = None,
) -> None:
    """Upsert coupling rows in chunks. Never commits — caller owns the txn.

    If any chunk fails, the exception propagates and the open transaction
    (including earlier chunks) can be rolled back by the caller.
    """
    if not values:
        return

    if batch_size is None:
        batch_size = _upsert_batch_size(len(values[0]))

    if batch_size < 1:
        raise ValueError("batch_size must be >= 1")

    for start in range(0, len(values), batch_size):
        chunk = values[start : start + batch_size]
        stmt = pg_insert(FileCoupling).values(chunk)
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

    # Flush once after all chunks succeed so a mid-batch failure
    # never leaves a partial flush committed by this function.
    await db.flush()


# ── Orchestrator (the only async function that touches the DB) ─────────


async def compute_couplings(
    db: AsyncSession,
    repo_id: uuid.UUID,
    min_co_commits: int = 3,
    max_files_per_commit: int = MAX_FILES_PER_COMMIT,
) -> None:
    """Compute co-change coupling scores for all file pairs in a repo.

    Commits that touch max_files_per_commit or more files are ignored so
    bulk imports do not look like coupling. Paths whose newest change is
    a DELETE are skipped, matching the risk report. Does not commit.
    Callers (e.g. ingest_repo) own the transaction so a failed upsert
    batch rolls back the whole ingestion.
    """

    # 1. Build subqueries
    deleted_paths = _deleted_paths(repo_id)
    repo_commit_sq = _repo_commit_ids(repo_id, max_files_per_commit)
    co_pairs = _co_occurrence_pairs(repo_commit_sq, min_co_commits, deleted_paths)
    file_totals = _file_total_commits(repo_commit_sq, deleted_paths)

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

    # Replace this repo's couplings so pairs that no longer qualify
    # (deleted files, fewer co-commits, etc.) do not linger.
    await db.execute(delete(FileCoupling).where(FileCoupling.repo_id == repo_id))
    if not rows:
        await db.flush()
        return

    values = _build_upsert_values(rows, repo_id)

    # 4. Upsert in batches under Postgres' bind-parameter limit
    await _upsert_couplings(db, values)
