import re
from subprocess import CalledProcessError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user_optional
from src.db.session import get_db
from src.services.ingestion.service import ingest_repo

router = APIRouter()

# https://github.com/owner/repo, with an optional .git or trailing slash.
GITHUB_REPO_URL = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+?(?:\.git)?/?$")


class RepoCreate(BaseModel):
    """Request body: the public GitHub repo URL to ingest."""

    url: str

    @field_validator("url")
    @classmethod
    def must_be_a_github_repo_url(cls, value: str) -> str:
        value = value.strip()
        if not GITHUB_REPO_URL.match(value):
            raise ValueError(
                "Must be a GitHub repository URL, e.g. https://github.com/owner/repo"
            )
        return value


@router.post("/repos", status_code=201)
async def connect_repo(
    payload: RepoCreate,
    user: dict | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Clone a public repo, parse its history, and store it in Postgres.

    Works without a session: issue #1 is "authenticate with GitHub (OAuth)
    *or* paste a public repo URL". Private repos will need the signed-in
    user's installation token, which is why `user` is resolved here even
    though only public cloning is wired up today.
    """
    try:
        await ingest_repo(payload.url, db)
    except CalledProcessError as exc:
        raise HTTPException(
            status_code=404,
            detail="Could not clone that repository. Check the URL is correct "
            "and the repository is public.",
        ) from exc

    return {"status": "ingested", "url": payload.url}