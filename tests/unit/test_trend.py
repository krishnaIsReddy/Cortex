import datetime
from collections import defaultdict

from src.services.scoring.ownership import Contribution, score_files
from src.services.scoring.trend import (
    MonthlyContribution,
    MonthlyLastChange,
    month_end,
    months_before,
    recency_weight,
    score_trend,
    window_start,
)

UTC = datetime.timezone.utc


def month(text):
    """"2026-05" -> date(2026, 5, 1)."""
    year, mon = map(int, text.split("-"))
    return datetime.date(year, mon, 1)


def lines(when, path, email, count, weighted=None):
    """Shorthand for one month of one author's lines; the name is the email's
    user part. Weighted as if every line was committed mid-month, unless given."""
    year, mon = map(int, when.split("-"))
    if weighted is None:
        weighted = count * recency_weight(datetime.datetime(year, mon, 15, tzinfo=UTC))
    return MonthlyContribution(
        month=month(when),
        file_path=path,
        author_email=email,
        author_name=email.split("@")[0],
        lines_added=count,
        weighted_lines=weighted,
    )


def commit(when, path, email, count):
    """One per-commit row, as ownership.score_files takes them. `when` is "2026-01-15"."""
    committed_at = datetime.datetime.fromisoformat(when).replace(tzinfo=UTC)
    return Contribution(path, email, email.split("@")[0], count, committed_at)


def monthly_totals(commits):
    """Add per-commit rows up into monthly rows, like trend_repository does in SQL."""
    totals = defaultdict(lambda: [0, 0.0])
    for c in commits:
        key = (c.committed_at.date().replace(day=1), c.file_path, c.author_email, c.author_name)
        totals[key][0] += c.lines_added
        totals[key][1] += c.lines_added * recency_weight(c.committed_at)
    return [
        MonthlyContribution(m, path, email, name, lines_added, weighted)
        for (m, path, email, name), (lines_added, weighted) in totals.items()
    ]


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
    # Exact weights, so the share is exactly 0.7 with no float rounding.
    [point] = score_trend(
        [
            lines("2026-01", "a.py", "ana@x.com", 70, weighted=70.0),
            lines("2026-01", "a.py", "ben@x.com", 30, weighted=30.0),
        ],
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


def test_every_month_matches_score_files_on_the_commits_so_far():
    commits = [
        commit("2024-01-10", "a.py", "ana@x.com", 100),
        commit("2024-02-03", "b.py", "ben@x.com", 40),
        commit("2024-02-20", "b.py", "ana@x.com", 45),
        commit("2025-06-01", "a.py", "ben@x.com", 30),
        commit("2025-06-30", "c.py", "Cat@X.com", 5),  # same author as cat@x.com
        commit("2026-01-15", "c.py", "cat@x.com", 5),
        commit("2026-01-31", "c.py", "dan@x.com", 3),
        commit("2026-01-31", "yarn.lock", "ana@x.com", 900),
    ]
    commits_per_month = defaultdict(int)
    for c in commits:
        commits_per_month[c.committed_at.date().replace(day=1)] += 1

    points = score_trend(monthly_totals(commits), [], dict(commits_per_month))

    assert len(points) == 25  # Jan 2024 to Jan 2026
    for point in points:
        so_far = [c for c in commits if c.committed_at.date() <= point.period_end]
        report = score_files(so_far)
        expected_high = sum(1 for f in report if f.risk_score >= 0.7)
        assert (point.high_risk_file_count, point.file_count) == (expected_high, len(report)), point


def test_recent_lines_count_for_more_than_old_ones():
    # ana wrote more lines, but 4 years earlier: by line count ben has 37.5%,
    # recency-weighted (half-life 365 days) he has about 90%.
    [*_, point] = score_trend(
        monthly_totals([
            commit("2022-01-15", "a.py", "ana@x.com", 100),
            commit("2026-01-15", "a.py", "ben@x.com", 60),
        ]),
        [],
        {month("2022-01"): 1, month("2026-01"): 1},
    )

    assert point.high_risk_file_count == 1


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


def test_history_collapsed_before_the_window_gives_the_same_points():
    """trend_repository adds all history before the window into the window's
    first month. The points must be the same as with month-by-month history."""
    commits = [
        commit("2024-03-05", "a.py", "ana@x.com", 100),
        commit("2024-03-20", "old.py", "ana@x.com", 30),
        commit("2024-09-12", "a.py", "ben@x.com", 20),
        commit("2025-02-01", "b.py", "ben@x.com", 50),
        commit("2025-07-15", "a.py", "cat@x.com", 40),
        commit("2026-01-10", "b.py", "ana@x.com", 45),
        commit("2026-03-03", "c.py", "dan@x.com", 10),
    ]
    changes = [
        change("2024-03", "a.py", "ADD"),
        change("2024-03", "old.py", "ADD"),
        change("2024-05", "old.py", "DELETE"),  # deleted before the window
        change("2025-02", "b.py", "ADD"),
        change("2025-04", "b.py", "DELETE"),
        change("2025-06", "b.py", "ADD"),  # re-added inside the window
    ]
    commits_per_month = defaultdict(int)
    for c in commits:
        commits_per_month[c.committed_at.date().replace(day=1)] += 1
    full = score_trend(monthly_totals(commits), changes, dict(commits_per_month), months=12)

    # What the database returns with `since`: earlier months moved into it.
    since = window_start(max(commits_per_month), 12)
    def bucket(m):
        return max(m, since)
    collapsed_rows = defaultdict(lambda: [0, 0.0])
    for row in monthly_totals(commits):
        key = (bucket(row.month), row.file_path, row.author_email, row.author_name)
        collapsed_rows[key][0] += row.lines_added
        collapsed_rows[key][1] += row.weighted_lines
    collapsed_changes = {}
    for row in sorted(changes, key=lambda r: r.month):  # the latest change per bucket wins
        collapsed_changes[(bucket(row.month), row.file_path)] = row.change_type
    collapsed_commits = defaultdict(int)
    for m, count in commits_per_month.items():
        collapsed_commits[bucket(m)] += count

    collapsed = score_trend(
        [MonthlyContribution(m, path, email, name, lines_added, weighted)
         for (m, path, email, name), (lines_added, weighted) in collapsed_rows.items()],
        [MonthlyLastChange(m, path, change_type) for (m, path), change_type in collapsed_changes.items()],
        dict(collapsed_commits),
        months=12,
    )

    assert since == month("2025-04")
    assert len(full) == 12
    assert collapsed == full
