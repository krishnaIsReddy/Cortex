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
    share: float  # 0 to 1, recency-weighted (what the risk score uses)
    historical_share: float  # 0 to 1, every line counted equally
    commit_count: int  # commits by this author that changed the file
    last_commit_at: datetime.datetime


class FileRiskOut(CamelModel):
    path: str
    risk_score: float  # 0 to 1, higher = riskier
    top_author: str
    top_author_share: float
    last_changed_at: datetime.datetime
    authors: list[AuthorShareOut]  # largest share first


class RiskReport(CamelModel):
    """Response of GET /api/repos/{repo_id}/risk-report."""

    repo: RepoDetails
    half_life_days: int  # commits this much older than the newest count half as much
    files: list[FileRiskOut]  # riskiest first


class FileCommitOut(CamelModel):
    sha: str
    author_name: str
    committed_at: datetime.datetime
    summary: str  # first line of the commit message
    change_type: str  # e.g. "ADD", "MODIFY", "RENAME"
    lines_added: int
    lines_removed: int


class FileDetail(FileRiskOut):
    """Response of GET /api/repos/{repo_id}/file-detail?path=..."""

    half_life_days: int
    commit_count: int  # every commit that changed the file
    commits: list[FileCommitOut]  # newest first, at most MAX_DETAIL_COMMITS
