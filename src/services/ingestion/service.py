from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repositories.repo_repository import (
    bulk_insert_commits,
    bulk_insert_file_changes,
    get_or_create_repo,
    update_last_synced,
)
from src.services.ingestion.clone import clone_or_pull
from src.services.ingestion.parser import parse_commits


async def ingest_repo(repo_url: str, db: AsyncSession) -> None:
    """Clone a repo, parse its commits, and persist everything to Postgres."""

    # 1. Clone the repo (or fetch if already cloned)
    local_path = clone_or_pull(repo_url)

    # 2. Create or update the repo record in the DB
    repo = await get_or_create_repo(db, repo_url, local_path)

    # 3. Parse every commit from the cloned repo
    commits = parse_commits(local_path)

    # 4. Bulk-insert commits (skips duplicates) and get sha→id mapping
    sha_to_id = await bulk_insert_commits(db, repo.id, commits)

    # 5. Insert file changes using the correct commit ID for each sha
    for commit_data in commits:
        cid = sha_to_id[commit_data["sha"]]
        await bulk_insert_file_changes(db, cid, commit_data["files"])

    # 6. Mark the repo as synced
    await update_last_synced(db, repo.id)

    # 7. Commit the whole transaction at once
    await db.commit()
