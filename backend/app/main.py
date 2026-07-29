"""FastAPI entrypoint: card API, health probes, and (in production) the built frontend."""

from pathlib import Path

from fastapi import FastAPI

from .api.cards import router as cards_router
from .frontend import mount_frontend

app = FastAPI(title="Commander's Companion")
app.include_router(cards_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    return {"status": "ok"}


# Registered last so it never shadows the routes above -- Starlette matches routes
# in registration order, and this adds a catch-all.
mount_frontend(app, Path(__file__).resolve().parent / "static")
