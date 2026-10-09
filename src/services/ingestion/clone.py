import subprocess
from pathlib import Path


def clone_or_pull(repo_url: str, base_dir: str = "repos/") -> str:
    """Clone a public repo (bare) if first time, or fetch if already cloned.

    Returns the local path to the bare repo on disk.
    """
    # Turn the URL into a folder name, e.g. "github.com-user-repo"
    repo_name = (
        repo_url.rstrip("/")
        .replace("https://", "")
        .replace("http://", "")
        .replace("/", "-")
    )
    dest = Path(base_dir) / repo_name

    if dest.exists():
        # Repo was already cloned — just fetch latest changes
        subprocess.run(
            ["git", "fetch", "--all"],
            cwd=str(dest),
            check=True,
            capture_output=True,
        )
    else:
        # First time — bare clone (smaller, faster; we only need history)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--bare", repo_url, str(dest)],
            check=True,
            capture_output=True,
        )

    return str(dest)
