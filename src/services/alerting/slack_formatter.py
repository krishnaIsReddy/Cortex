from src.services.scoring.models import FileRisk

# Slack allows 50 blocks per message; keep digests short and readable
MAX_FILES_SHOWN = 10

def repo_display_name(repo_url: str) -> str:
    """Turn a repo URL into "owner/repo" (e.g. https://github.com/a/b.git -> a/b)"""
    path = repo_url.rstrip("/").removesuffix(".git")
    return "/".join(path.split("/")[-2:])

def _escape(text: str) -> str:
    """Escape the characters Slack treats as control characters in message text"""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def format_digest(repo_name: str, files: list[FileRisk]) -> dict:
    """Build a Slack Block Kit message listing files that became high-risk"""
    count = f"{len(files)} file{'' if len(files) == 1 else 's'}"
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"{count} became high-risk"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"Repo: *{_escape(repo_name)}*"}},
        {"type": "divider"},
    ]
    for risk in files[:MAX_FILES_SHOWN]:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"`{_escape(risk.file_path)}`\n"
                    f"Risk {risk.risk_score:.0%} · *{_escape(risk.top_owner)}* "
                    f"owns {risk.top_owner_share:.0%} of lines"
                ),
            },
        })
    hidden = len(files) - MAX_FILES_SHOWN
    if hidden > 0:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"…and {hidden} more"}],
        })

    # "text" is the fallback shown in notifications and by clients that can't render blocks
    return {"text": f"Cortex: {count} in {_escape(repo_name)} became high-risk", "blocks": blocks}
