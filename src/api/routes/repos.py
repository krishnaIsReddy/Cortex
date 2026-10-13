from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.auth import get_current_user
from src.db.session import get_db
from src.services.ingestion.service import ingest_repo

router = APIRouter()


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
