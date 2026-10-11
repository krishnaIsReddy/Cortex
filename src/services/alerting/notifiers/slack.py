import logging
import httpx

from .base import Notifier

logger = logging.getLogger(__name__)

class SlackNotifier(Notifier):
    """Notifier class for a Slack application"""
    def send(self, destination: str, message: dict) -> bool:
        try:
            res = httpx.post(destination, json=message, timeout=10)
            res.raise_for_status()
        except httpx.HTTPStatusError as err:
            logger.error("Slack send failed: HTTP %s %s", err.response.status_code, err.response.text)
            return False
        except httpx.HTTPError as err:
            logger.error("Slack send failed: %s", type(err).__name__)
            return False
        return True
