"""Response models for the co-change coupling endpoints.

Fields are snake_case in Python but sent as camelCase JSON (e.g. file_a ->
"fileA"), matching what the dashboard expects.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that serializes field names as camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class FileCouplingOut(CamelModel):
    """One file pair from GET /api/repos/{repo_id}/couplings."""

    file_a: str
    file_b: str
    co_commit_count: int
    total_commits_a: int
    total_commits_b: int
    coupling_score: float


class CouplingsResponse(CamelModel):
    """Response of GET /api/repos/{repo_id}/couplings."""

    status: Literal["pending", "ready", "failed"]
    couplings: list[FileCouplingOut]
