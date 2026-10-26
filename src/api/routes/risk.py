"""Endpoints that serve ownership risk to the dashboard.

  GET    /api/repos                          -> list of ingested repos
  GET    /api/repos/{repo_id}/risk-report    -> repo details + per-file risk
  GET    /api/repos/{repo_id}/file-detail    -> one file's authors + commits (?path=...)
  DELETE /api/repos/{repo_id}                -> remove a repo (signed-in users only)

Ingesting a repo is still POST /repos (see repos.py).

The GET endpoints don't require sign-in because only public repos can be
ingested so far. Before private repos are supported, they must check that the
user has access to the repo.
"""

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user
from src.api.schemas.risk import FileCommitOut, FileDetail, RepoDetails, RepoSummary, RiskReport
from src.db.models.repo import Repo
from src.db.repositories.risk_repository import (
    delete_repo,
    file_history_contributions,
    get_contributions,
    get_file_history,
    get_repo,
    get_repo_stats,
    list_repos,
)
from src.db.session import get_db
from src.services.scoring.ownership import HALF_LIFE_DAYS, normalize_path, score_files

router = APIRouter(prefix="/api/repos", tags=["risk"])

# The drill-down lists this many of a file's most recent commits.
MAX_DETAIL_COMMITS = 50


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
        half_life_days=HALF_LIFE_DAYS,
        # Scoring results use the same field names, so asdict() converts them
        # (including the nested author shares) straight into the response model.
        files=[asdict(file) for file in files],
    )


@router.get("/{repo_id}/file-detail", response_model=FileDetail)
async def get_file_detail(
    repo_id: uuid.UUID,
    path: str = Query(description='File path from the risk report, e.g. "src/api/auth.py"'),
    db: AsyncSession = Depends(get_db),
) -> FileDetail:
    """Score one file and list its recent commits, for the dashboard's drill-down.

    The path is a query parameter because file paths contain "/".
    """
    if await get_repo(db, repo_id) is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    path = normalize_path(path)
    history = await get_file_history(db, repo_id, path)
    # Shares are ratios, so scoring the file on its own gives the same result
    # as in the full report (see ownership.py).
    scored = score_files(file_history_contributions(path, history))
    if not scored:
        # Never seen, deleted, or not scored (e.g. a lock file or binary file).
        raise HTTPException(status_code=404, detail="File not found in this repository")

    return FileDetail(
        **asdict(scored[0]),
        half_life_days=HALF_LIFE_DAYS,
        commit_count=len(history),
        commits=[
            FileCommitOut(
                sha=commit.sha,
                author_name=commit.author_name,
                committed_at=commit.committed_at,
                summary=commit.message.splitlines()[0] if commit.message else "",
                change_type=commit.change_type,
                lines_added=commit.lines_added,
                lines_removed=commit.lines_removed,
            )
            for commit in history[:MAX_DETAIL_COMMITS]
        ],
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
