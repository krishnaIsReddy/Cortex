import uuid

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user
from src.db.models.file_coupling import FileCoupling
from src.db.session import get_db
from src.services.ingestion.service import ingest_repo

router = APIRouter(prefix="/api")


class RepoCreate(BaseModel):
    """Request body: the public GitHub repo URL to ingest."""
    url: str


@router.post("/repos", status_code=201)
async def connect_repo(
    payload: RepoCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a public repo, parse its history, and store it in Postgres."""
    await ingest_repo(payload.url, db)
    return {"status": "ingested", "url": payload.url}


@router.get("/repos/{repo_id}/couplings")
async def get_couplings(
    repo_id: uuid.UUID,
    min_score: float = Query(0.3, ge=0.0, le=1.0, description="Minimum coupling score to include"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of pairs to return"),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return file pairs sorted by coupling score (descending)."""
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

    return [
        {
            "fileA": c.file_a,
            "fileB": c.file_b,
            "coCommitCount": c.co_commit_count,
            "totalCommitsA": c.total_commits_a,
            "totalCommitsB": c.total_commits_b,
            "couplingScore": round(c.coupling_score, 4),
        }
        for c in couplings
    ]
