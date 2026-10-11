import uuid
from dataclasses import dataclass

@dataclass(frozen=True)
class FileRisk:
    # TODO: should be agreed with the team before scoring PR (#4) is built.
    """Ownership risk for one file in a repo (output of scoring, input to alerting/dashboard)"""
    repo_id: uuid.UUID
    file_path: str
    risk_score: float       # 0-1, higher is riskier
    top_owner: str
    top_owner_share: float  # 0-1, top author's share of the file's lines
