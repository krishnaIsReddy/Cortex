from abc import ABC, abstractmethod

class Notifier(ABC):
    """Abstract class for an alert notifier (e.g. a Slack bot or Email client)"""
    @abstractmethod
    def send(self, destination: str, message: dict) -> bool:
        """Send a message to a destination (e.g. a WebHook URL). Returns True on success."""
