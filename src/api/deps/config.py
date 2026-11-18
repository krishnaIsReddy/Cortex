import base64
import logging
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    github_client_id: str
    github_client_secret: str
    github_callback_url: str = "http://localhost:8000/api/auth/github/callback"

    github_app_id: str | None = None
    github_app_private_key_b64: str | None = None

    # Empty by default so a missing value is detectable below.
    session_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"

    # Google Gemini, for the AI risk summary (src/ai/explainer.py). Without a
    # key, summaries fall back to a plain template of the same numbers.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"

    @property
    def github_private_key(self) -> str:
        if not self.github_app_private_key_b64:
            raise RuntimeError("GITHUB_APP_PRIVATE_KEY_B64 is not set")
        return base64.b64decode(self.github_app_private_key_b64).decode()


settings = Settings()

if not settings.session_secret_key:
    logging.getLogger(__name__).warning(
        "SESSION_SECRET_KEY is not set; using a throwaway key. Sessions will "
        "not survive a restart, and multi-worker deployments will reject each "
        "other's cookies. Set it in .env."
    )
    settings.session_secret_key = secrets.token_hex(32)