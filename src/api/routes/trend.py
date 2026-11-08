"""Endpoint for the dashboard's "Risk over time" chart.

  GET /api/repos/{repo_id}/risk-trend            -> one point per month, oldest first
  GET /api/repos/{repo_id}/risk-trend?months=12  -> only the latest 12 months

Open without sign-in, like the other read endpoints in risk.py (only public
repos can be ingested so far).
"""

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas.trend import TrendPointOut
from src.db.repositories.risk_repository import get_repo
from src.db.repositories.trend_repository import (
    get_commits_per_month,
    get_monthly_contributions,
    get_monthly_last_changes,
)
from src.db.session import get_db
from src.services.scoring.trend import score_trend

router = APIRouter(prefix="/api/repos", tags=["risk"])


@router.get("/{repo_id}/risk-trend", response_model=list[TrendPointOut])
async def get_risk_trend(
    repo_id: uuid.UUID,
    months: int | None = Query(
        default=None, ge=1, le=1200, description="Only return the latest N months (default: all)."
    ),
    db: AsyncSession = Depends(get_db),
) -> list[TrendPointOut]:
    """Score the repo at the end of every month of its history (or the latest
    `months` of it). The window ends at the latest commit, not today.

    Computed on each request from the stored history, like the risk report.
    Returns [] for a repo with no commits.
    """
    if await get_repo(db, repo_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    points = score_trend(
        await get_monthly_contributions(db, repo_id),
        await get_monthly_last_changes(db, repo_id),
        await get_commits_per_month(db, repo_id),
        months=months,
    )
    return [asdict(point) for point in points]
