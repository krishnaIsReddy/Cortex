import uuid
import datetime

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.commit import Commit
from src.db.models.file_change import FileChange
from src.db.models.repo import Repo


async def create_repo(db: AsyncSession, url: str, local_path: str) -> Repo:
    """Insert a new repo row and return it."""
    repo = Repo(url=url, local_path=local_path)
    db.add(repo)
    await db.flush()
    return repo


async def get_repo_by_url(db: AsyncSession, url: str) -> Repo | None:
    """Look up a repo by URL, or return None if it does not exist."""
    result = await db.execute(select(Repo).where(Repo.url == url))
    return result.scalar_one_or_none()


async def get_or_create_repo(
    db: AsyncSession, url: str, local_path: str
) -> Repo:
    """Return the existing repo for this URL, or create it if missing."""
    repo = await get_repo_by_url(db, url)
    if repo is None:
        repo = await create_repo(db, url, local_path)
    else:
        repo.local_path = local_path
        await db.flush()
    return repo


async def bulk_insert_commits(
    db: AsyncSession, repo_id: uuid.UUID, commit_dicts: list[dict]
) -> list[uuid.UUID]:
    """Insert commits in bulk and return their generated IDs."""
    if not commit_dicts:
        return []

    commit_ids: list[uuid.UUID] = []
    rows = []
    for c in commit_dicts:
        cid = uuid.uuid4()
        commit_ids.append(cid)
        rows.append(
            {
                "id": cid,
                "repo_id": repo_id,
                "sha": c["sha"],
                "author_name": c["author_name"],
                "author_email": c["author_email"],
                "committed_at": c["committed_at"],
                "message": c["message"],
                "insertions": c["insertions"],
                "deletions": c["deletions"],
            }
        )

    stmt = pg_insert(Commit).values(rows).on_conflict_do_nothing()
    await db.execute(stmt)
    return commit_ids


async def bulk_insert_file_changes(
    db: AsyncSession,
    commit_id: uuid.UUID,
    change_dicts: list[dict],
) -> None:
    """Insert file changes for a single commit in bulk."""
    if not change_dicts:
        return

    rows = [
        {
            "id": uuid.uuid4(),
            "commit_id": commit_id,
            "file_path": fc["file_path"],
            "old_path": fc.get("old_path"),
            "change_type": fc["change_type"],
            "lines_added": fc.get("lines_added", 0),
            "lines_removed": fc.get("lines_removed", 0),
        }
        for fc in change_dicts
    ]

    stmt = pg_insert(FileChange).values(rows).on_conflict_do_nothing()
    await db.execute(stmt)


async def update_last_synced(db: AsyncSession, repo_id: uuid.UUID) -> None:
    """Stamp last_synced_at to now for the given repo."""
    await db.execute(
        update(Repo)
        .where(Repo.id == repo_id)
        .values(last_synced_at=datetime.datetime.now(datetime.UTC))
    )
    await db.flush()
