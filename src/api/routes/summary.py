"""Endpoint for the file drill-down's "Summarize" button (issue #16).

  POST /api/repos/{repo_id}/file-summary?path=... -> 2-3 sentence explanation

POST because it can call Gemini, which uses the free quota; the dashboard only
calls it when someone clicks the button. Open without sign-in, like analyzing
a repo. Each file's summary is cached until the repo is analyzed again.
"""

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.explainer import gemini_generator, summarize_file
from src.api.deps.config import settings
from src.api.schemas.summary import FileSummaryOut
from src.db.repositories.risk_repository import count_file_commits, get_contributions, get_repo
from src.db.session import get_db
from src.services.scoring.ownership import normalize_path, score_files

router = APIRouter(prefix="/api/repos", tags=["ai"])


@router.post("/{repo_id}/file-summary", response_model=FileSummaryOut)
async def summarize_file_risk(
    repo_id: uuid.UUID,
    path: str = Query(description='File path from the risk report, e.g. "src/api/auth.py"'),
    db: AsyncSession = Depends(get_db),
) -> FileSummaryOut:
    """Explain in plain language why the file has its risk score.

    Written by Gemini from the same numbers as the file drill-down, or a plain
    template of those numbers if Gemini isn't configured or the call fails.
    """
    repo = await get_repo(db, repo_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Scored exactly like the file drill-down in risk.py, so the summary
    # describes the numbers shown next to it.
    path = normalize_path(path)
    scored = next(
        (file for file in score_files(await get_contributions(db, repo_id)) if file.path == path),
        None,
    )
    if scored is None:
        raise HTTPException(status_code=404, detail="File not found in this repository")

    generate = (
        gemini_generator(settings.gemini_api_key, settings.gemini_model)
        if settings.gemini_api_key
        else None
    )
    summary = await summarize_file(
        scored,
        await count_file_commits(db, repo_id, path),
        generate,
        # A new analysis or a different model gets a fresh summary.
        cache_key=(repo_id, path, repo.last_synced_at, settings.gemini_model),
    )
    return FileSummaryOut(**asdict(summary))
