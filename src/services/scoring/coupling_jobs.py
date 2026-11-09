"""Background job + in-memory status for co-change coupling.

Kept separate from compute_couplings so scoring stays pure DB work and the
HTTP layer can schedule this after ingest returns.
"""

from __future__ import annotations

import logging
import uuid

from src.db.session import async_session
from src.services.scoring.coupling import compute_couplings

logger = logging.getLogger(__name__)

# Process-local job state. Lost on restart; fine for the demo. Values are
# "pending" or "failed"; missing means ready (or never scheduled).
_job_status: dict[uuid.UUID, str] = {}


def mark_coupling_pending(repo_id: uuid.UUID) -> None:
    _job_status[repo_id] = "pending"


def mark_coupling_ready(repo_id: uuid.UUID) -> None:
    _job_status.pop(repo_id, None)


def mark_coupling_failed(repo_id: uuid.UUID) -> None:
    _job_status[repo_id] = "failed"


def coupling_job_status(repo_id: uuid.UUID) -> str:
    """Return "pending", "failed", or "ready"."""
    return _job_status.get(repo_id, "ready")


async def compute_couplings_job(repo_id: uuid.UUID) -> None:
    """Run coupling scoring in its own DB session after ingest returns."""
    try:
        async with async_session() as db:
            await compute_couplings(db, repo_id)
            await db.commit()
        mark_coupling_ready(repo_id)
    except Exception:
        logger.exception("Coupling computation failed for repo %s", repo_id)
        mark_coupling_failed(repo_id)
