import subprocess
import tempfile
import os

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import Base
from src.db.models.repo import Repo  # noqa: F401
from src.db.models.commit import Commit  # noqa: F401
from src.db.models.file_change import FileChange  # noqa: F401
from src.services.ingestion.service import ingest_repo

DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://cortex:cortex@localhost:5432/cortex",
)


@pytest_asyncio.fixture
async def db_session():
    """Create tables, yield a session, then drop everything."""
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


def _create_fixture_repo(tmp_dir: str) -> str:
    """Create a tiny git repo with one commit."""
    repo_path = os.path.join(tmp_dir, "integration-repo")
    os.makedirs(repo_path)

    env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@test.com",
           "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@test.com"}
    run = lambda cmd: subprocess.run(cmd, cwd=repo_path, check=True, capture_output=True, env=env)

    run(["git", "init"])
    with open(os.path.join(repo_path, "file.txt"), "w") as f:
        f.write("content\n")
    run(["git", "add", "."])
    run(["git", "commit", "-m", "first commit"])

    return repo_path


@pytest.mark.asyncio
async def test_ingest_repo_persists_data(db_session, monkeypatch):
    """Full pipeline: clone → parse → persist, then verify rows in Postgres."""

    # Use a local fixture repo instead of cloning from GitHub
    tmp = tempfile.mkdtemp()
    fixture_path = _create_fixture_repo(tmp)

    # Patch clone_or_pull to return our fixture repo path
    monkeypatch.setattr(
        "src.services.ingestion.service.clone_or_pull",
        lambda url: fixture_path,
    )

    await ingest_repo("https://github.com/test/fake-repo", db_session)

    # Verify repo row was created
    result = await db_session.execute(text("SELECT COUNT(*) FROM repos"))
    assert result.scalar() == 1

    # Verify commit row was created
    result = await db_session.execute(text("SELECT COUNT(*) FROM commits"))
    assert result.scalar() == 1

    # Verify file_change row was created
    result = await db_session.execute(text("SELECT COUNT(*) FROM file_changes"))
    assert result.scalar() >= 1

    # Verify last_synced_at was set
    result = await db_session.execute(text("SELECT last_synced_at FROM repos"))
    assert result.scalar() is not None


@pytest.mark.asyncio
async def test_re_ingest_does_not_duplicate(db_session, monkeypatch):
    """Ingesting the same repo twice should not create duplicate commits."""

    tmp = tempfile.mkdtemp()
    fixture_path = _create_fixture_repo(tmp)

    monkeypatch.setattr(
        "src.services.ingestion.service.clone_or_pull",
        lambda url: fixture_path,
    )

    await ingest_repo("https://github.com/test/fake-repo", db_session)
    await ingest_repo("https://github.com/test/fake-repo", db_session)

    result = await db_session.execute(text("SELECT COUNT(*) FROM commits"))
    assert result.scalar() == 1, "Re-ingest should not duplicate commits"
