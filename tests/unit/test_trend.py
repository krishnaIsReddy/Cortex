import datetime

from src.services.scoring.ownership import Contribution, score_files
from src.services.scoring.trend import (
    MonthlyContribution,
    MonthlyLastChange,
    month_end,
    months_before,
    score_trend,
)


def month(text):
    """"2026-05" -> date(2026, 5, 1)."""
    year, mon = map(int, text.split("-"))
    return datetime.date(year, mon, 1)


def lines(when, path, email, count):
    """Shorthand for one month of one author's lines; the name is the email's user part."""
    return MonthlyContribution(
        month=month(when),
        file_path=path,
        author_email=email,
        author_name=email.split("@")[0],
        lines_added=count,
    )


def change(when, path, change_type):
    return MonthlyLastChange(month=month(when), file_path=path, change_type=change_type)


def test_no_commits_gives_no_points():
    assert score_trend([], [], {}) == []


def test_one_point_per_month_including_months_without_commits():
    points = score_trend(
        [lines("2026-01", "a.py", "ana@x.com", 10)],
        [change("2026-01", "a.py", "ADD")],
        {month("2026-01"): 2, month("2026-04"): 1},
    )

    assert [p.period_end for p in points] == [
        datetime.date(2026, 1, 31),
        datetime.date(2026, 2, 28),
        datetime.date(2026, 3, 31),
        datetime.date(2026, 4, 30),
    ]


def test_months_continue_across_the_new_year():
    points = score_trend([], [], {month("2025-11"): 1, month("2026-02"): 1})

    assert [p.period_end.isoformat() for p in points] == [
        "2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28",
    ]


def test_commit_count_is_cumulative():
    points = score_trend([], [], {month("2026-01"): 3, month("2026-03"): 2})

    assert [p.commit_count for p in points] == [3, 3, 5]


def test_share_changes_as_ownership_spreads():
    points = score_trend(
        [
            lines("2026-01", "a.py", "ana@x.com", 80),
            lines("2026-01", "b.py", "ana@x.com", 10),
            lines("2026-01", "b.py", "ben@x.com", 10),
            lines("2026-02", "a.py", "ben@x.com", 80),  # a.py is now 50/50
        ],
        [],
        {month("2026-01"): 2, month("2026-02"): 1},
    )

    jan, feb = points
    assert (jan.high_risk_file_count, jan.file_count, jan.high_risk_share) == (1, 2, 0.5)
    assert (feb.high_risk_file_count, feb.file_count, feb.high_risk_share) == (0, 2, 0.0)


def test_threshold_is_inclusive():
    [point] = score_trend(
        [lines("2026-01", "a.py", "ana@x.com", 70), lines("2026-01", "a.py", "ben@x.com", 30)],
        [],
        {month("2026-01"): 1},
    )

    assert point.high_risk_file_count == 1


def test_deleted_file_drops_out_and_comes_back_when_re_added():
    points = score_trend(
        [lines("2026-01", "a.py", "ana@x.com", 10), lines("2026-01", "b.py", "ana@x.com", 10)],
        [
            change("2026-01", "a.py", "ADD"),
            change("2026-01", "b.py", "ADD"),
            change("2026-02", "a.py", "DELETE"),
            change("2026-03", "a.py", "ADD"),
        ],
        {month("2026-01"): 1, month("2026-02"): 1, month("2026-03"): 1},
    )

    assert [p.file_count for p in points] == [2, 1, 2]


def test_skips_the_same_files_and_authors_as_the_risk_report():
    [point] = score_trend(
        [
            lines("2026-01", "app.py", "ana@x.com", 10),
            lines("2026-01", "package-lock.json", "ana@x.com", 5000),
            lines("2026-01", "deps.txt", "dependabot[bot]@x.com", 10),
        ],
        [],
        {month("2026-01"): 3},
    )

    assert point.file_count == 1


def test_latest_point_matches_scoring_all_history_at_once():
    rows = [
        lines("2026-01", "a.py", "ana@x.com", 50),
        lines("2026-02", "a.py", "ben@x.com", 10),
        lines("2026-02", "b.py", "ben@x.com", 30),
        lines("2026-03", "c.py", "ana@x.com", 5),
        lines("2026-03", "c.py", "cat@x.com", 5),
    ]
    points = score_trend(rows, [], {month("2026-01"): 1, month("2026-02"): 1, month("2026-03"): 1})

    report = score_files([
        Contribution(r.file_path, r.author_email, r.author_name, r.lines_added) for r in rows
    ])
    expected_high = sum(1 for f in report if f.risk_score >= 0.7)
    assert (points[-1].high_risk_file_count, points[-1].file_count) == (expected_high, len(report))


def test_month_end_handles_leap_years():
    assert month_end(datetime.date(2028, 2, 1)) == datetime.date(2028, 2, 29)
    assert month_end(datetime.date(2026, 2, 1)) == datetime.date(2026, 2, 28)
    assert month_end(datetime.date(2026, 12, 1)) == datetime.date(2026, 12, 31)


def history_over_six_months():
    """ana writes a.py in Jan, then ben joins a little more each month."""
    rows = [lines("2026-01", "a.py", "ana@x.com", 100)]
    rows += [lines(f"2026-0{m}", "a.py", "ben@x.com", 20) for m in range(2, 7)]
    commits = {month(f"2026-0{m}"): 1 for m in range(1, 7)}
    return rows, commits


def test_months_keeps_only_the_latest_months():
    rows, commits = history_over_six_months()

    points = score_trend(rows, [], commits, months=3)

    assert [p.period_end.isoformat() for p in points] == ["2026-04-30", "2026-05-31", "2026-06-30"]


def test_months_window_has_the_same_numbers_as_full_history():
    rows, commits = history_over_six_months()

    full = score_trend(rows, [], commits)
    window = score_trend(rows, [], commits, months=3)

    # Earlier months still count: commits and ownership are cumulative.
    assert window == full[-3:]
    assert window[0].commit_count == 4


def test_months_longer_than_history_returns_everything():
    rows, commits = history_over_six_months()

    assert score_trend(rows, [], commits, months=24) == score_trend(rows, [], commits)


def test_months_before_crosses_years():
    assert months_before(datetime.date(2026, 3, 1), 4) == datetime.date(2025, 11, 1)
    assert months_before(datetime.date(2026, 1, 1), 0) == datetime.date(2026, 1, 1)
    assert months_before(datetime.date(2026, 1, 1), 25) == datetime.date(2023, 12, 1)
