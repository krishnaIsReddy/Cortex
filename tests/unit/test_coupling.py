"""Tests for co-change coupling scores and pair deduplication.

Score math is checked with plain Python objects. Pair detection runs
against Postgres using seeded commits, then the session is rolled back
so local data is left unchanged.
"""

import os
import uuid
from datetime import datetime, timedelta, UTC
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import Base
from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.db.models.file_coupling import FileCoupling
from src.db.models.repo import Repo
from src.services.scoring.coupling import (
    PG_MAX_QUERY_PARAMS,
    _build_upsert_values,
    _upsert_batch_size,
    _upsert_couplings,
    compute_couplings,
)

DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://cortex:cortex@localhost:5432/cortex",
)


@pytest_asyncio.fixture
async def db_session():
    """Open a session and roll it back so seeded rows never persist."""
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()


async def _seed_repo(db: AsyncSession, url: str, commits: list[list[str]]) -> uuid.UUID:
    """Insert a repo whose commits each touch the given file paths.

    ``commits`` is one list of file paths per commit. Example:
    [["a.py", "b.py"], ["a.py"]] means two commits.
    """
    repo = Repo(url=url, local_path="/tmp/coupling-fixture")
    db.add(repo)
    await db.flush()

    now = datetime.now(UTC)
    for index, paths in enumerate(commits):
        commit = Commit(
            repo_id=repo.id,
            sha=f"{index:040x}",
            author_name="Test",
            author_email="test@test.com",
            committed_at=now,
            message=f"commit {index}",
            insertions=1,
            deletions=0,
        )
        db.add(commit)
        await db.flush()
        for path in paths:
            db.add(
                FileChange(
                    commit_id=commit.id,
                    file_path=path,
                    change_type="MODIFY",
                    lines_added=1,
                    lines_removed=0,
                )
            )
    await db.flush()
    return repo.id


async def _couplings(db: AsyncSession, repo_id: uuid.UUID) -> list[FileCoupling]:
    result = await db.execute(
        select(FileCoupling)
        .where(FileCoupling.repo_id == repo_id)
        .order_by(FileCoupling.file_a, FileCoupling.file_b)
    )
    return list(result.scalars().all())


class TestCouplingScoreMath:
    """The score formula does not need a database."""

    def test_score_divides_by_the_busier_file(self):
        repo_id = uuid.uuid4()
        row = SimpleNamespace(
            file_a="a.py",
            file_b="b.py",
            co_commit_count=2,
            total_commits_a=4,
            total_commits_b=2,
        )

        values = _build_upsert_values([row], repo_id)

        assert values[0]["coupling_score"] == pytest.approx(2 / 4)
        assert values[0]["file_a"] == "a.py"
        assert values[0]["repo_id"] == repo_id

    def test_perfect_overlap_scores_one(self):
        row = SimpleNamespace(
            file_a="a.py",
            file_b="b.py",
            co_commit_count=5,
            total_commits_a=5,
            total_commits_b=5,
        )

        values = _build_upsert_values([row], uuid.uuid4())

        assert values[0]["coupling_score"] == pytest.approx(1.0)


class TestComputeCouplings:
    """Pair detection against seeded commits."""

    @pytest.mark.asyncio
    async def test_files_always_changed_together_score_one(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/always-together",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py", "b.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert (rows[0].file_a, rows[0].file_b) == ("a.py", "b.py")
        assert rows[0].co_commit_count == 3
        assert rows[0].coupling_score == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_score_uses_the_file_with_more_commits(self, db_session):
        """a.py is also edited alone, so the pair is 3 / max(4, 3)."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/partial",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py", "b.py"], ["a.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert rows[0].co_commit_count == 3
        assert rows[0].total_commits_a == 4
        assert rows[0].total_commits_b == 3
        assert rows[0].coupling_score == pytest.approx(3 / 4)

    @pytest.mark.asyncio
    async def test_pairs_are_stored_once_in_alphabetical_order(self, db_session):
        """Three files in one commit are three pairs, not six, and z comes second."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/dedup",
            [["z.py", "a.py", "m.py"], ["z.py", "a.py", "m.py"], ["z.py", "a.py", "m.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        pairs = {(row.file_a, row.file_b) for row in rows}
        assert pairs == {("a.py", "m.py"), ("a.py", "z.py"), ("m.py", "z.py")}
        assert all(row.file_a < row.file_b for row in rows)

    @pytest.mark.asyncio
    async def test_two_shared_commits_are_ignored_by_default(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/twice",
            [["a.py", "b.py"], ["a.py", "b.py"]],
        )

        await compute_couplings(db_session, repo_id)

        assert await _couplings(db_session, repo_id) == []

    @pytest.mark.asyncio
    async def test_single_co_occurrence_is_ignored_by_default(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/once",
            [["a.py", "b.py"], ["a.py"], ["b.py"]],
        )

        await compute_couplings(db_session, repo_id)

        assert await _couplings(db_session, repo_id) == []

    @pytest.mark.asyncio
    async def test_min_co_commits_can_include_a_single_shared_commit(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/once-allowed",
            [["a.py", "b.py"]],
        )

        await compute_couplings(db_session, repo_id, min_co_commits=1)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert rows[0].coupling_score == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_a_file_is_not_coupled_to_itself(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/solo",
            [["only.py"], ["only.py"], ["only.py"]],
        )

        await compute_couplings(db_session, repo_id, min_co_commits=1)

        assert await _couplings(db_session, repo_id) == []

    @pytest.mark.asyncio
    async def test_empty_repo_writes_nothing(self, db_session):
        repo_id = await _seed_repo(db_session, "https://example.com/empty", [])

        await compute_couplings(db_session, repo_id, min_co_commits=1)

        assert await _couplings(db_session, repo_id) == []

    @pytest.mark.asyncio
    async def test_other_repos_do_not_affect_the_score(self, db_session):
        target = await _seed_repo(
            db_session,
            "https://example.com/target",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py", "b.py"]],
        )
        await _seed_repo(
            db_session,
            "https://example.com/other",
            [["a.py"], ["a.py"], ["a.py"]],
        )

        await compute_couplings(db_session, target)

        rows = await _couplings(db_session, target)
        assert len(rows) == 1
        assert rows[0].total_commits_a == 3
        assert rows[0].coupling_score == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_recompute_updates_the_same_row(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/recompute",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py", "b.py"]],
        )
        await compute_couplings(db_session, repo_id)

        extra = Commit(
            repo_id=repo_id,
            sha="f" * 40,
            author_name="Test",
            author_email="test@test.com",
            committed_at=datetime.now(UTC),
            message="a alone",
            insertions=1,
            deletions=0,
        )
        db_session.add(extra)
        await db_session.flush()
        db_session.add(
            FileChange(
                commit_id=extra.id,
                file_path="a.py",
                change_type="MODIFY",
                lines_added=1,
                lines_removed=0,
            )
        )
        await db_session.flush()

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        count = await db_session.scalar(
            select(func.count()).select_from(FileCoupling).where(FileCoupling.repo_id == repo_id)
        )
        assert count == 1
        assert rows[0].total_commits_a == 4
        assert rows[0].coupling_score == pytest.approx(3 / 4)

    @pytest.mark.asyncio
    async def test_large_commit_is_left_out_of_the_score(self, db_session):
        """A commit at the file limit does not raise totals or add pairs."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/one-wide-commit",
            [
                ["a.py", "b.py"],
                ["a.py", "b.py"],
                ["a.py", "b.py"],
                ["a.py", "b.py", "c.py"],
            ],
        )

        await compute_couplings(db_session, repo_id, max_files_per_commit=3)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert (rows[0].file_a, rows[0].file_b) == ("a.py", "b.py")
        assert rows[0].co_commit_count == 3
        assert rows[0].total_commits_a == 3
        assert rows[0].total_commits_b == 3

    @pytest.mark.asyncio
    async def test_only_large_commits_produce_no_pairs(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/only-wide",
            [["a.py", "b.py", "c.py"], ["a.py", "b.py", "c.py"], ["a.py", "b.py", "c.py"]],
        )

        await compute_couplings(db_session, repo_id, max_files_per_commit=3)

        assert await _couplings(db_session, repo_id) == []
        stored_changes = await db_session.scalar(
            select(func.count())
            .select_from(FileChange)
            .join(Commit, Commit.id == FileChange.commit_id)
            .where(Commit.repo_id == repo_id)
        )
        assert stored_changes == 9

    @pytest.mark.asyncio
    async def test_deleted_files_are_excluded_from_couplings(self, db_session):
        """A path whose newest change is DELETE must not appear in pairs."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/deleted-coupling",
            [
                ["a.py", "b.py", "c.py"],
                ["a.py", "b.py", "c.py"],
                ["a.py", "b.py", "c.py"],
            ],
        )

        delete_commit = Commit(
            repo_id=repo_id,
            sha="d" * 40,
            author_name="Test",
            author_email="test@test.com",
            # Newer than the seeded MODIFY commits (which share one timestamp).
            committed_at=datetime.now(UTC) + timedelta(seconds=1),
            message="delete a.py",
            insertions=0,
            deletions=1,
        )
        db_session.add(delete_commit)
        await db_session.flush()
        db_session.add(
            FileChange(
                commit_id=delete_commit.id,
                file_path="a.py",
                change_type="DELETE",
                lines_added=0,
                lines_removed=1,
            )
        )
        await db_session.flush()

        await compute_couplings(db_session, repo_id)

        pairs = {(row.file_a, row.file_b) for row in await _couplings(db_session, repo_id)}
        assert pairs == {("b.py", "c.py")}
        assert all("a.py" not in pair for pair in pairs)

    @pytest.mark.asyncio
    async def test_recompute_drops_pairs_for_deleted_files(self, db_session):
        """Stale couplings naming a later-deleted file are removed on recompute."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/stale-deleted",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py", "b.py"]],
        )
        await compute_couplings(db_session, repo_id)
        assert len(await _couplings(db_session, repo_id)) == 1

        delete_commit = Commit(
            repo_id=repo_id,
            sha="e" * 40,
            author_name="Test",
            author_email="test@test.com",
            committed_at=datetime.now(UTC) + timedelta(seconds=1),
            message="delete a.py",
            insertions=0,
            deletions=1,
        )
        db_session.add(delete_commit)
        await db_session.flush()
        db_session.add(
            FileChange(
                commit_id=delete_commit.id,
                file_path="a.py",
                change_type="DELETE",
                lines_added=0,
                lines_removed=1,
            )
        )
        await db_session.flush()

        await compute_couplings(db_session, repo_id)
        assert await _couplings(db_session, repo_id) == []


class TestUpsertBatching:
    """Chunked upsert stays under Postgres' bind-parameter limit."""

    def test_batch_size_scales_with_column_count(self):
        for columns in (1, 9, 20):
            size = _upsert_batch_size(columns)
            assert size * columns < PG_MAX_QUERY_PARAMS
            assert size >= 1

    def test_batch_size_shrinks_when_more_columns_are_added(self):
        assert _upsert_batch_size(18) < _upsert_batch_size(9)

    def test_batch_size_rejects_invalid_column_count(self):
        with pytest.raises(ValueError):
            _upsert_batch_size(0)

    @pytest.mark.asyncio
    async def test_upsert_writes_all_rows_across_multiple_chunks(self, db_session):
        """Force tiny batches so many pairs require more than one INSERT."""
        repo = Repo(url="https://example.com/chunked", local_path="/tmp/chunked")
        db_session.add(repo)
        await db_session.flush()

        now = datetime.now(UTC)
        values = [
            {
                "id": uuid.uuid4(),
                "repo_id": repo.id,
                "file_a": f"a{i:04d}.py",
                "file_b": f"b{i:04d}.py",
                "co_commit_count": 2,
                "total_commits_a": 2,
                "total_commits_b": 2,
                "coupling_score": 1.0,
                "updated_at": now,
            }
            for i in range(25)
        ]

        await _upsert_couplings(db_session, values, batch_size=10)

        count = await db_session.scalar(
            select(func.count())
            .select_from(FileCoupling)
            .where(FileCoupling.repo_id == repo.id)
        )
        assert count == 25

    @pytest.mark.asyncio
    async def test_failed_chunk_leaves_no_partial_couplings(self, db_session, monkeypatch):
        """If a later chunk fails, earlier chunks are rolled back with the txn."""
        repo = Repo(url="https://example.com/partial-fail", local_path="/tmp/partial")
        db_session.add(repo)
        await db_session.flush()

        now = datetime.now(UTC)
        values = [
            {
                "id": uuid.uuid4(),
                "repo_id": repo.id,
                "file_a": f"a{i:04d}.py",
                "file_b": f"b{i:04d}.py",
                "co_commit_count": 2,
                "total_commits_a": 2,
                "total_commits_b": 2,
                "coupling_score": 1.0,
                "updated_at": now,
            }
            for i in range(5)
        ]

        real_execute = db_session.execute
        call_count = {"n": 0}

        async def fail_on_second_chunk(statement, *args, **kwargs):
            call_count["n"] += 1
            # First chunk succeeds; second chunk blows up before flush/commit.
            if call_count["n"] >= 2:
                raise RuntimeError("simulated mid-batch failure")
            return await real_execute(statement, *args, **kwargs)

        monkeypatch.setattr(db_session, "execute", fail_on_second_chunk)

        with pytest.raises(RuntimeError, match="simulated mid-batch failure"):
            await _upsert_couplings(db_session, values, batch_size=2)

        await db_session.rollback()

        count = await db_session.scalar(
            select(func.count())
            .select_from(FileCoupling)
            .where(FileCoupling.repo_id == repo.id)
        )
        assert count == 0
