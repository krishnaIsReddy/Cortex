from pydriller import Repository as PDRepository


def parse_commits(local_repo_path: str) -> list[dict]:
    """Walk every commit in the repo via PyDriller and return structured dicts.

    Each dict contains commit metadata plus a 'files' list of per-file changes.
    """
    results = []

    for commit in PDRepository(local_repo_path).traverse_commits():
        commit_data = {
            "sha": commit.hash,
            "author_name": commit.author.name,
            "author_email": commit.author.email,
            "committed_at": commit.committer_date,
            "message": commit.msg,
            "insertions": commit.insertions,
            "deletions": commit.deletions,
            "files": [],
        }

        for mod in commit.modified_files:
            commit_data["files"].append({
                "file_path": mod.new_path or mod.old_path,
                "old_path": mod.old_path,
                "change_type": mod.change_type.name,
                "lines_added": mod.added_lines,
                "lines_removed": mod.deleted_lines,
            })

        results.append(commit_data)

    return results
