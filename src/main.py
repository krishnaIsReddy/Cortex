from fastapi import FastAPI

from src.api.routes.repos import router as repos_router

app = FastAPI(title="Cortex")

app.include_router(repos_router)
