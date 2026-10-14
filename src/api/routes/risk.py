"""Endpoints that serve ownership risk to the dashboard.

  GET    /api/repos                          -> list of ingested repos
  GET    /api/repos/{repo_id}/risk-report    -> repo details + per-file risk
  DELETE /api/repos/{repo_id}                -> remove a repo (signed-in users only)

Ingesting a repo is still POST /repos (see repos.py).

The GET endpoints don't require sign-in because only public repos can be
ingested so far. Before private repos are supported, they must check that the
user has access to the repo.
"""

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user
from src.api.schemas.risk import RepoDetails, RepoSummary, RiskReport
from src.db.models.repo import Repo
from src.db.repositories.risk_repository import (
    delete_repo,
    get_contributions,
    get_repo,
    get_repo_stats,
    list_repos,
)
from src.db.session import get_db
from src.services.scoring.ownership import score_files

router = APIRouter(prefix="/api/repos", tags=["risk"])


def repo_display_name(url: str) -> str:
    """Turn "https://github.com/owner/repo(.git)" into "owner/repo"."""
    path = url.rstrip("/").removesuffix(".git")
    return "/".join(path.split("/")[-2:])


def to_summary(repo: Repo) -> RepoSummary:
    return RepoSummary(
        id=repo.id,
        name=repo_display_name(repo.url),
        url=repo.url,
        analyzed_at=repo.last_synced_at,
    )


@router.get("", response_model=list[RepoSummary])
async def get_repos(db: AsyncSession = Depends(get_db)) -> list[RepoSummary]:
    """List every ingested repo, most recently analyzed first."""
    return [to_summary(repo) for repo in await list_repos(db)]


@router.get("/{repo_id}/risk-report", response_model=RiskReport)
async def get_risk_report(repo_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> RiskReport:
    """Score every file in the repo and return the dashboard's report.

    Scores are computed on each request from the stored history (fast enough
    for the demo; they could be cached or stored later).
    """
    repo = await get_repo(db, repo_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    commit_count, contributor_count = await get_repo_stats(db, repo_id)
    files = score_files(await get_contributions(db, repo_id))

    return RiskReport(
        repo=RepoDetails(
            **to_summary(repo).model_dump(),
            branch=None,
            commit_count=commit_count,
            contributor_count=contributor_count,
        ),
        # Scoring results use the same field names, so asdict() converts them
        # (including the nested author shares) straight into the response model.
        files=[asdict(file) for file in files],
    )


@router.delete("/{repo_id}", status_code=204)
async def remove_repo(
    repo_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a repo and all of its ingested history. Requires sign-in.

    The local clone in repos/ is kept, so re-analyzing it later is faster.
    """
    if not await delete_repo(db, repo_id):
        raise HTTPException(status_code=404, detail="Repository not found")
