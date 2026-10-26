"""Tests for co-change coupling scores and pair deduplication.

Score math is checked with plain Python objects. Pair detection runs
against Postgres using seeded commits, then the session is rolled back
so local data is left unchanged.
"""

import os
import uuid
from datetime import datetime, UTC
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
from src.services.scoring.coupling import _build_upsert_values, compute_couplings

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
            [["a.py", "b.py"], ["a.py", "b.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert (rows[0].file_a, rows[0].file_b) == ("a.py", "b.py")
        assert rows[0].co_commit_count == 2
        assert rows[0].coupling_score == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_score_uses_the_file_with_more_commits(self, db_session):
        """a.py is also edited alone, so the pair is 2 / max(3, 2)."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/partial",
            [["a.py", "b.py"], ["a.py", "b.py"], ["a.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        assert len(rows) == 1
        assert rows[0].co_commit_count == 2
        assert rows[0].total_commits_a == 3
        assert rows[0].total_commits_b == 2
        assert rows[0].coupling_score == pytest.approx(2 / 3)

    @pytest.mark.asyncio
    async def test_pairs_are_stored_once_in_alphabetical_order(self, db_session):
        """Three files in one commit are three pairs, not six, and z comes second."""
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/dedup",
            [["z.py", "a.py", "m.py"], ["z.py", "a.py", "m.py"]],
        )

        await compute_couplings(db_session, repo_id)

        rows = await _couplings(db_session, repo_id)
        pairs = {(row.file_a, row.file_b) for row in rows}
        assert pairs == {("a.py", "m.py"), ("a.py", "z.py"), ("m.py", "z.py")}
        assert all(row.file_a < row.file_b for row in rows)

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
            [["a.py", "b.py"], ["a.py", "b.py"]],
        )
        await _seed_repo(
            db_session,
            "https://example.com/other",
            [["a.py"], ["a.py"], ["a.py"]],
        )

        await compute_couplings(db_session, target)

        rows = await _couplings(db_session, target)
        assert len(rows) == 1
        assert rows[0].total_commits_a == 2
        assert rows[0].coupling_score == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_recompute_updates_the_same_row(self, db_session):
        repo_id = await _seed_repo(
            db_session,
            "https://example.com/recompute",
            [["a.py", "b.py"], ["a.py", "b.py"]],
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
        assert rows[0].total_commits_a == 3
        assert rows[0].coupling_score == pytest.approx(2 / 3)
