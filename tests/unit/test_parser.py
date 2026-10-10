import subprocess
import tempfile
import os

from src.services.ingestion.parser import parse_commits


def _create_fixture_repo(tmp_dir: str) -> str:
    """Create a tiny git repo with two commits for testing."""
    repo_path = os.path.join(tmp_dir, "fixture-repo")
    os.makedirs(repo_path)

    env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@test.com",
           "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@test.com"}
    run = lambda cmd: subprocess.run(cmd, cwd=repo_path, check=True, capture_output=True, env=env)

    run(["git", "init"])

    # First commit — add a file
    with open(os.path.join(repo_path, "hello.txt"), "w") as f:
        f.write("hello world\n")
    run(["git", "add", "."])
    run(["git", "commit", "-m", "initial commit"])

    # Second commit — modify the file
    with open(os.path.join(repo_path, "hello.txt"), "a") as f:
        f.write("second line\n")
    run(["git", "add", "."])
    run(["git", "commit", "-m", "add second line"])

    return repo_path


class TestParseCommits:
    """Unit tests for the PyDriller commit parser."""

    def test_returns_correct_number_of_commits(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)
            assert len(commits) == 2

    def test_commit_has_required_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)

            required_keys = {
                "sha", "author_name", "author_email",
                "committed_at", "message", "insertions",
                "deletions", "files",
            }
            for commit in commits:
                assert required_keys.issubset(commit.keys())

    def test_first_commit_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)
            assert commits[0]["message"].strip() == "initial commit"

    def test_file_changes_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)

            # Both commits touch hello.txt
            for commit in commits:
                assert len(commit["files"]) >= 1

    def test_file_change_has_required_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)

            required_keys = {
                "file_path", "old_path", "change_type",
                "lines_added", "lines_removed",
            }
            for commit in commits:
                for fc in commit["files"]:
                    assert required_keys.issubset(fc.keys())

    def test_sha_is_40_chars(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_path = _create_fixture_repo(tmp)
            commits = parse_commits(repo_path)
            for commit in commits:
                assert len(commit["sha"]) == 40
