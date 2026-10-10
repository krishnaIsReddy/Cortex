import base64
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

    # Generated per process in dev; set it in .env for anything deployed.
    session_secret_key: str = secrets.token_hex(32)
    frontend_url: str = "http://localhost:5173"

    @property
    def github_private_key(self) -> str:
        if not self.github_app_private_key_b64:
            raise RuntimeError("GITHUB_APP_PRIVATE_KEY_B64 is not set")
        return base64.b64decode(self.github_app_private_key_b64).decode()


settings = Settings()