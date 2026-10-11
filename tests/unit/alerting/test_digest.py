import uuid

from src.services.alerting.digest import build_digest
from src.services.scoring.models import FileRisk

REPO_ID = uuid.uuid4()

def risk(path, score):
    return FileRisk(REPO_ID, path, score, "alice", score)

def test_new_file_above_threshold_is_reported():
    digest = build_digest([risk("a.py", 0.9)], already_alerted=set(), threshold=0.8)

    assert [r.file_path for r in digest.newly_high_risk] == ["a.py"]

def test_file_below_threshold_is_ignored():
    digest = build_digest([risk("a.py", 0.5)], already_alerted=set(), threshold=0.8)

    assert digest.newly_high_risk == []

def test_threshold_is_inclusive():
    digest = build_digest([risk("a.py", 0.8)], already_alerted=set(), threshold=0.8)

    assert [r.file_path for r in digest.newly_high_risk] == ["a.py"]

def test_already_alerted_file_is_not_reported_again():
    digest = build_digest([risk("a.py", 0.9)], already_alerted={"a.py"}, threshold=0.8)

    assert digest.newly_high_risk == []
    assert digest.resolved == []

def test_alerted_file_back_below_threshold_is_resolved():
    digest = build_digest([risk("a.py", 0.3)], already_alerted={"a.py"}, threshold=0.8)

    assert digest.resolved == ["a.py"]

def test_alerted_file_no_longer_scored_is_resolved():
    digest = build_digest([], already_alerted={"deleted.py"}, threshold=0.8)

    assert digest.resolved == ["deleted.py"]

def test_newly_high_risk_sorted_riskiest_first():
    risks = [risk("b.py", 0.85), risk("a.py", 0.99), risk("c.py", 0.85)]

    digest = build_digest(risks, already_alerted=set(), threshold=0.8)

    assert [r.file_path for r in digest.newly_high_risk] == ["a.py", "b.py", "c.py"]
