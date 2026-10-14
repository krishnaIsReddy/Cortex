"""Response models for the risk report endpoints.

Fields are snake_case in Python but sent as camelCase JSON (e.g. top_author_share
-> "topAuthorShare"), matching what the dashboard expects. The frontend's
src/frontend/src/services/mockData/index.js documents the same shape.
"""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that serializes field names as camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RepoSummary(CamelModel):
    """One ingested repo, as listed by GET /api/repos."""

    id: uuid.UUID
    name: str  # "owner/repo"
    url: str
    analyzed_at: datetime.datetime | None


class RepoDetails(RepoSummary):
    """Repo details shown in the dashboard header."""

    branch: str | None  # not recorded by ingestion yet, so currently always null
    commit_count: int
    contributor_count: int


class AuthorShareOut(CamelModel):
    name: str
    share: float  # 0 to 1


class FileRiskOut(CamelModel):
    path: str
    risk_score: float  # 0 to 1, higher = riskier
    top_author: str
    top_author_share: float
    authors: list[AuthorShareOut]  # largest share first


class RiskReport(CamelModel):
    """Response of GET /api/repos/{repo_id}/risk-report."""

    repo: RepoDetails
    files: list[FileRiskOut]  # riskiest first
