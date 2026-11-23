import re
import uuid
from datetime import datetime
from subprocess import CalledProcessError

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user, get_current_user_optional
from src.api.schemas.coupling import CouplingsResponse, FileCouplingOut
from src.db.models.file_coupling import FileCoupling
from src.db.repositories.risk_repository import get_repo
from src.db.session import get_db
from src.services.ingestion.service import ingest_repo
from src.services.scoring.coupling import DEFAULT_MAX_COMMITS
from src.services.scoring.coupling_jobs import (
    compute_couplings_job,
    coupling_job_status,
    mark_coupling_pending,
)

# Ingest stays at POST /repos (see vite proxy + riskApi.js). Couplings live under
# /api/repos/... with the other dashboard read APIs.
router = APIRouter()

GITHUB_REPO_URL = re.compile(
    r"^https://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?$"
)


class CouplingWindow(BaseModel):
    """Optional commit window for coupling. Pass max_commits=null for full history."""

    max_commits: int | None = Field(default=DEFAULT_MAX_COMMITS, ge=1)
    since: datetime | None = None


class RepoCreate(CouplingWindow):
    """Request body: the public GitHub repo URL to ingest."""

    url: str

    @field_validator("url")
    @classmethod
    def must_be_a_github_repo_url(cls, value: str) -> str:
        match = GITHUB_REPO_URL.match(value.strip())
        if not match:
            raise ValueError(
                "Must be a GitHub repository URL, e.g. https://github.com/owner/repo"
            )

        owner, repo = match.group("owner"), match.group("repo")
        return f"https://github.com/{owner.lower()}/{repo.lower()}"


@router.post("/repos", status_code=201)
async def connect_repo(
    payload: RepoCreate,
    background_tasks: BackgroundTasks,
    user: dict | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Clone a public repo, parse its history, and store it in Postgres.

    Works without a session: issue #1 is "authenticate with GitHub (OAuth)
    *or* paste a public repo URL". Private repos will need the signed-in
    user's installation token, which is why `user` is resolved here even
    though only public cloning is wired up today.

    Co-change coupling runs in the background after the response is sent.
    """
    try:
        repo = await ingest_repo(payload.url, db)
    except CalledProcessError as exc:
        raise HTTPException(
            status_code=404,
            detail="Could not clone that repository. Check the URL is correct "
            "and the repository is public.",
        ) from exc

    mark_coupling_pending(repo.id)
    background_tasks.add_task(
        compute_couplings_job,
        repo.id,
        payload.max_commits,
        payload.since,
    )
    return {
        "status": "ingested",
        "url": payload.url,
        "repoId": str(repo.id),
        "couplingStatus": "pending",
    }


@router.get("/api/repos/{repo_id}/couplings", response_model=CouplingsResponse)
async def get_couplings(
    repo_id: uuid.UUID,
    min_score: float = Query(0.3, ge=0.0, le=1.0, description="Minimum coupling score to include"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of pairs to return"),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CouplingsResponse:
    """Return coupling status and file pairs sorted by score (descending).

    While a background job is running, `status` is "pending" and `couplings`
    is empty so the UI can show "Determining coupling…".
    """
    status = coupling_job_status(repo_id)
    if status == "pending":
        return CouplingsResponse(status="pending", couplings=[])
    if status == "failed":
        return CouplingsResponse(status="failed", couplings=[])

    stmt = (
        select(FileCoupling)
        .where(
            FileCoupling.repo_id == repo_id,
            FileCoupling.coupling_score >= min_score,
        )
        .order_by(FileCoupling.coupling_score.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    couplings = result.scalars().all()

    return CouplingsResponse(
        status="ready",
        couplings=[
            FileCouplingOut(
                file_a=c.file_a,
                file_b=c.file_b,
                co_commit_count=c.co_commit_count,
                total_commits_a=c.total_commits_a,
                total_commits_b=c.total_commits_b,
                coupling_score=round(c.coupling_score, 4),
            )
            for c in couplings
        ],
    )


@router.post("/api/repos/{repo_id}/couplings/recompute")
async def recompute_couplings(
    repo_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: CouplingWindow | None = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run coupling with an optional wider/narrower commit window.

    Body may include max_commits and/or since (JSON null clears the count cap).
    Does not re-ingest the repo — only recomputes scores from stored history.
    """
    if await get_repo(db, repo_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    window = payload or CouplingWindow()
    mark_coupling_pending(repo_id)
    background_tasks.add_task(
        compute_couplings_job,
        repo_id,
        window.max_commits,
        window.since,
    )
    return {"status": "pending", "repoId": str(repo_id)}
