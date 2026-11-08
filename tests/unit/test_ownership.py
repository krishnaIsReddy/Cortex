import datetime

import pytest

from src.services.scoring.ownership import HALF_LIFE_DAYS, Contribution, score_files

NOW = datetime.datetime(2026, 10, 1, tzinfo=datetime.timezone.utc)


def row(path, email, lines, name=None, days_ago=0):
    """Shorthand for one contribution; the name defaults to the email's user part.

    Commits default to the same moment, so decay doesn't change their shares.
    """
    return Contribution(
        file_path=path,
        author_email=email,
        author_name=name or email.split("@")[0],
        lines_added=lines,
        committed_at=NOW - datetime.timedelta(days=days_ago),
    )


def test_single_author_owns_whole_file():
    [file] = score_files([row("app.py", "ana@x.com", 50)])

    assert file.risk_score == 1.0
    assert file.top_author == "ana"
    assert [(a.name, a.share) for a in file.authors] == [("ana", 1.0)]


def test_shares_split_by_lines_added():
    [file] = score_files([row("app.py", "ana@x.com", 75), row("app.py", "ben@x.com", 25)])

    assert file.top_author == "ana"
    assert file.top_author_share == 0.75
    assert [(a.name, a.share) for a in file.authors] == [("ana", 0.75), ("ben", 0.25)]


def test_files_sorted_riskiest_first():
    files = score_files([
        row("shared.py", "ana@x.com", 50),
        row("shared.py", "ben@x.com", 50),
        row("solo.py", "ana@x.com", 10),
    ])

    assert [f.path for f in files] == ["solo.py", "shared.py"]


def test_same_email_with_two_names_counts_as_one_author():
    [file] = score_files([
        row("app.py", "dev@x.com", 30, name="haradeep1"),
        row("app.py", "dev@x.com", 70, name="Haradeep Puneti"),
        row("app.py", "ben@x.com", 100),
    ])

    names = {a.name: a.share for a in file.authors}
    # The name used for the most lines is shown.
    assert names == {"Haradeep Puneti": 0.5, "ben": 0.5}


def test_email_matching_ignores_case():
    [file] = score_files([row("app.py", "Ana@X.com", 10), row("app.py", "ana@x.com", 10)])

    assert len(file.authors) == 1


def test_windows_paths_are_normalized_and_merged():
    files = score_files([
        row("src\\api\\auth.py", "ana@x.com", 60),
        row("src/api/auth.py", "ben@x.com", 40),
    ])

    assert [f.path for f in files] == ["src/api/auth.py"]
    assert files[0].top_author_share == 0.6


def test_lock_files_and_bots_are_skipped():
    files = score_files([
        row("src/frontend/package-lock.json", "ana@x.com", 900),
        row("app.py", "dependabot[bot]@users.noreply.github.com", 5, name="dependabot[bot]"),
        row("app.py", "ana@x.com", 10),
    ])

    assert [f.path for f in files] == ["app.py"]
    assert [a.name for a in files[0].authors] == ["ana"]


def test_files_with_no_lines_added_are_skipped():
    assert score_files([row("logo.png", "ana@x.com", 0)]) == []


def test_empty_input_returns_empty_list():
    assert score_files([]) == []


def test_older_commits_count_less():
    # Equal lines, but ana's are one half-life older, so they count half as much.
    [file] = score_files([
        row("app.py", "ana@x.com", 100, days_ago=HALF_LIFE_DAYS),
        row("app.py", "ben@x.com", 100),
    ])

    shares = {a.name: a.share for a in file.authors}
    assert shares["ben"] == pytest.approx(2 / 3)
    assert shares["ana"] == pytest.approx(1 / 3)
    assert file.top_author == "ben"
    assert file.risk_score == pytest.approx(2 / 3)


def test_recent_rewrite_overtakes_original_author():
    # ana wrote most of the file two years ago; ben has done most work since.
    [file] = score_files([
        row("app.py", "ana@x.com", 500, days_ago=730),
        row("app.py", "ben@x.com", 150, days_ago=30),
    ])

    assert file.top_author == "ben"
    historical = {a.name: a.historical_share for a in file.authors}
    assert historical["ana"] == pytest.approx(500 / 650)


def test_age_is_measured_from_newest_commit_not_today():
    # A repo nobody has touched in years scores the same as an active one.
    recent = score_files([
        row("app.py", "ana@x.com", 100, days_ago=HALF_LIFE_DAYS),
        row("app.py", "ben@x.com", 100),
    ])
    dormant = score_files([
        row("app.py", "ana@x.com", 100, days_ago=HALF_LIFE_DAYS + 1000),
        row("app.py", "ben@x.com", 100, days_ago=1000),
    ])

    assert dormant[0].risk_score == pytest.approx(recent[0].risk_score)


def test_last_changed_and_per_author_stats():
    [file] = score_files([
        row("app.py", "ana@x.com", 40, days_ago=90),
        row("app.py", "ana@x.com", 10, days_ago=10),
        row("app.py", "ben@x.com", 0, days_ago=2),  # a deletion-only commit
        row("app.py", "cat@x.com", 50, days_ago=400),
    ])

    # ben's commit added no lines, so ben has no share, but it still counts as a change.
    assert file.last_changed_at == NOW - datetime.timedelta(days=2)
    assert [a.name for a in file.authors] == ["ana", "cat"]
    ana = file.authors[0]
    assert ana.commit_count == 2
    assert ana.last_commit_at == NOW - datetime.timedelta(days=10)


def test_bot_commits_do_not_count_as_changes():
    [file] = score_files([
        row("app.py", "ana@x.com", 10, days_ago=100),
        row("app.py", "dependabot[bot]@x.com", 1, name="dependabot[bot]"),
    ])

    assert file.last_changed_at == NOW - datetime.timedelta(days=100)
