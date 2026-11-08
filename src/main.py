from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from src.api.deps.config import settings
from src.api.routes.auth import router as auth_router
from src.api.routes.repos import router as repos_router
from src.api.routes.risk import router as risk_router

app = FastAPI(title="Cortex")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    session_cookie="cortex_session",
    max_age=60 * 60 * 24 * 7,
    same_site="lax",
    https_only=False,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos_router)
app.include_router(auth_router)
app.include_router(risk_router)