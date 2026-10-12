from dataclasses import dataclass
from typing import Iterable

from src.services.scoring.models import FileRisk

DEFAULT_THRESHOLD = 0.8

@dataclass(frozen=True)
class Digest:
    """Result of comparing a repo's current scores against the files already alerted on"""
    newly_high_risk: list[FileRisk]  # alert on these, riskiest first
    resolved: list[str]              # alerted before but no longer high-risk; clear from history so they can alert again

def build_digest(
    risks: Iterable[FileRisk],
    already_alerted: set[str],
    threshold: float = DEFAULT_THRESHOLD,
) -> Digest:
    """Pick out files that have crossed into high-risk since the last digest for this repo.

    A file is high-risk when its risk_score is at or above the threshold. Files in
    already_alerted that are now below the threshold (or no longer scored, e.g.
    deleted) are returned as resolved.
    """
    high_risk = [risk for risk in risks if risk.risk_score >= threshold]
    high_risk_paths = {risk.file_path for risk in high_risk}

    newly_high_risk = sorted(
        (risk for risk in high_risk if risk.file_path not in already_alerted),
        key=lambda risk: (-risk.risk_score, risk.file_path),
    )
    resolved = sorted(already_alerted - high_risk_paths)
    return Digest(newly_high_risk=newly_high_risk, resolved=resolved)
