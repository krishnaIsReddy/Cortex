from fastapi import HTTPException, Request


def get_current_user(request: Request) -> dict:
    """Return the signed-in user, or raise 401 if the session is missing."""
    github_id = request.session.get("github_id")
    github_login = request.session.get("github_login")
    if github_id is None or not github_login:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "github_id": github_id,
        "github_login": github_login,
        "avatar_url": request.session.get("avatar_url"),
        "installation_id": request.session.get("installation_id"),
    }
