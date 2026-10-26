from src.services.scoring.ownership import Contribution, score_files


def row(path, email, lines, name=None):
    """Shorthand for one contribution; the name defaults to the email's user part."""
    return Contribution(
        file_path=path,
        author_email=email,
        author_name=name or email.split("@")[0],
        lines_added=lines,
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
