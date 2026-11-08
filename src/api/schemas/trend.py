"""Response model for the risk trend endpoint, sent as camelCase JSON like
schemas/risk.py. The frontend's src/frontend/src/services/mockData/trends.js
documents the same shape.
"""

import datetime

from src.api.schemas.risk import CamelModel


class TrendPointOut(CamelModel):
    """One month of GET /api/repos/{repo_id}/risk-trend."""

    period_end: datetime.date  # last day of the month
    high_risk_share: float  # 0 to 1
    high_risk_file_count: int
    file_count: int
    commit_count: int  # commits up to and including this month
