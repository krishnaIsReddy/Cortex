import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from src.api.deps.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


@router.get("/github/login")
def login(request: Request) -> RedirectResponse:
    """Redirect to GitHub to authorize this app."""
    state = secrets.token_hex(16)
    request.session["oauth_state"] = state

    params = urlencode({
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_callback_url,
        "state": state,
    })
    return RedirectResponse(f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/callback")
def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    installation_id: int | None = None,
) -> RedirectResponse:
    """Validate state, exchange the code for a token, store the identity."""
    expected = request.session.pop("oauth_state", None)
    if not state or state != expected:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    with httpx.Client(timeout=10) as client:
        token_resp = client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_callback_url,
            },
        )
        token_resp.raise_for_status()
        token = token_resp.json().get("access_token")
        if not token:
            raise HTTPException(status_code=400, detail="GitHub did not return a token")

        user_resp = client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        user_resp.raise_for_status()
        profile = user_resp.json()

    # The access token is used here and discarded -- never stored.
    request.session["github_id"] = profile["id"]
    request.session["github_login"] = profile["login"]
    request.session["avatar_url"] = profile.get("avatar_url")
    if installation_id is not None:
        request.session["installation_id"] = installation_id

    return RedirectResponse(settings.frontend_url)


@router.get("/me")
def me(request: Request) -> dict:
    """Return the signed-in user, or 401 if there is no session."""
    github_login = request.session.get("github_login")
    if not github_login:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "github_id": request.session["github_id"],
        "github_login": github_login,
        "avatar_url": request.session.get("avatar_url"),
        "installation_id": request.session.get("installation_id"),
    }


@router.post("/logout", status_code=204)
def logout(request: Request) -> None:
    """Clear the session."""
    request.session.clear()