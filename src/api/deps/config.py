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
    # Must match the browser origin that starts login (Vite in dev), so the
    # session cookie set on /github/login is sent back on /github/callback.
    # localhost and 127.0.0.1 are different cookie hosts — pick one and stick to it.
    github_callback_url: str = "http://localhost:5173/api/auth/github/callback"

    github_app_id: str | None = None
    github_app_private_key_b64: str | None = None

    # Empty by default so a missing value is detectable below.
    session_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"

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