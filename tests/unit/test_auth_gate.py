import asyncio
import json
import os
from base64 import b64encode

os.environ.setdefault("GITHUB_CLIENT_ID", "test-client")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test-secret")

import httpx
import itsdangerous

from src.api.deps.config import settings
from src.db.session import get_db
from src.main import app


async def _fake_db():
    yield None


async def _fake_ingest(url: str, db) -> None:
    return None


def _session_cookie(data: dict) -> str:
    signer = itsdangerous.TimestampSigner(str(settings.session_secret_key))
    payload = b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


def _run(coro):
    app.dependency_overrides[get_db] = _fake_db
    try:
        return asyncio.run(coro)
    finally:
        app.dependency_overrides.clear()


def test_post_repos_requires_login(monkeypatch):
    monkeypatch.setattr("src.api.routes.repos.ingest_repo", _fake_ingest)

    async def request():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            return await client.post(
                "/repos", json={"url": "https://github.com/octocat/Hello-World"}
            )

    response = _run(request())
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_post_repos_accepts_logged_in_user(monkeypatch):
    monkeypatch.setattr("src.api.routes.repos.ingest_repo", _fake_ingest)

    async def request():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            client.cookies.set(
                "cortex_session",
                _session_cookie({"github_id": 1, "github_login": "octocat"}),
            )
            return await client.post(
                "/repos", json={"url": "https://github.com/octocat/Hello-World"}
            )

    response = _run(request())
    assert response.status_code == 201
    assert response.json() == {
        "status": "ingested",
        "url": "https://github.com/octocat/Hello-World",
    }


def test_me_uses_same_session_check():
    async def request():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            anonymous = await client.get("/api/auth/me")
            client.cookies.set(
                "cortex_session",
                _session_cookie(
                    {
                        "github_id": 1,
                        "github_login": "octocat",
                        "avatar_url": None,
                        "installation_id": None,
                    }
                ),
            )
            signed_in = await client.get("/api/auth/me")
            return anonymous, signed_in

    anonymous, signed_in = _run(request())
    assert anonymous.status_code == 401
    assert signed_in.status_code == 200
    assert signed_in.json()["github_login"] == "octocat"
