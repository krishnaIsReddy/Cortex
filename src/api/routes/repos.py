import uuid

from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user
from src.api.schemas.coupling import CouplingsResponse, FileCouplingOut
from src.db.models.file_coupling import FileCoupling
from src.db.session import get_db
from src.services.ingestion.service import ingest_repo
from src.services.scoring.coupling_jobs import (
    compute_couplings_job,
    coupling_job_status,
    mark_coupling_pending,
)

router = APIRouter(prefix="/api")


class RepoCreate(BaseModel):
    """Request body: the public GitHub repo URL to ingest."""
    url: str


@router.post("/repos", status_code=201)
async def connect_repo(
    payload: RepoCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a public repo, parse its history, and store it in Postgres.

    Co-change coupling runs in the background after the response is sent.
    """
    repo = await ingest_repo(payload.url, db)
    mark_coupling_pending(repo.id)
    background_tasks.add_task(compute_couplings_job, repo.id)
    return {
        "status": "ingested",
        "url": payload.url,
        "repoId": str(repo.id),
        "couplingStatus": "pending",
    }


@router.get("/repos/{repo_id}/couplings", response_model=CouplingsResponse)
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
