"""Send a sample digest to Slack to check the webhook and the message format.

Usage (from the repo root):
    python -m src.services.alerting.send_test_alert

Reads SLACK_WEBHOOK_URL from the environment or from a .env file at the repo root.
"""
import logging
import os
import sys
import uuid

from dotenv import load_dotenv

from src.services.alerting.digest import build_digest
from src.services.alerting.slack_formatter import format_digest
from src.services.alerting.notifiers.slack import SlackNotifier
from src.services.scoring.models import FileRisk

SAMPLE_REPO_ID = uuid.uuid4()
SAMPLE_RISKS = [
    FileRisk(SAMPLE_REPO_ID, "src/billing/super_important.py", 0.95, "alice", 0.95),
    FileRisk(SAMPLE_REPO_ID, "src/auth/session.py", 0.88, "bob", 0.88),
    FileRisk(SAMPLE_REPO_ID, "src/api/routes/users.py", 0.82, "alice", 0.82),
    FileRisk(SAMPLE_REPO_ID, "README.md", 0.40, "carol", 0.40),  # below threshold, not shown
]

def main() -> int:
    logging.basicConfig()  # not INFO: httpx logs request URLs at INFO, and the webhook URL is a secret
    load_dotenv()
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL is not set. Add it to .env at the repo root or set it in the shell.", file=sys.stderr)
        return 1

    digest = build_digest(SAMPLE_RISKS, already_alerted=set())
    message = format_digest("cortex/sample-repo", digest.newly_high_risk)
    message["text"] = f"[TEST] {message['text']}"
    message["blocks"].insert(0, {
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": ":test_tube: Test alert from Cortex (sample data)"}],
    })

    if not SlackNotifier().send(webhook_url, message):
        print("Sending failed, see the error above.", file=sys.stderr)
        return 1
    print("Test alert sent.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
