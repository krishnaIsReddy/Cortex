"""Response model for the AI file summary, sent as camelCase JSON like schemas/risk.py."""

from typing import Literal

from src.api.schemas.risk import CamelModel


class SummaryAuthorOut(CamelModel):
    label: str  # e.g. "Author A", as it appears in the summary text
    name: str  # the author's real name, for the dashboard to show in its place


class FileSummaryOut(CamelModel):
    """Response of POST /api/repos/{repo_id}/file-summary?path=..."""

    text: str  # 2-3 sentences; refers to authors by label, e.g. "Author A"
    authors: list[SummaryAuthorOut]  # the name behind every label in `text`
    source: Literal["ai", "template"]  # "template" when Gemini wasn't used
    # Why the template was used: "not_configured", "rate_limited", "failed",
    # or "invalid_output". None for AI summaries.
    reason: str | None
