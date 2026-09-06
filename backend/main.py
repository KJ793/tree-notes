"""
to run:
docker compose down -v (wipes database)
docker compose up -d --build
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
curl.exe http://localhost:8000/health        (backend direct)
curl.exe http://localhost:8080/api/health    (through the nginx proxy)
http://localhost:8000/docs
verify with:
docker compose run --rm backend alembic -c backend/alembic.ini current

alembic needs -c because the code lives at /app/backend while `docker compose
run` starts in /app, so alembic.ini is not in the working directory.
"""

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from backend.database import engine

from backend.routers import ai_adapter, auth, groups, note_graph, notes, profile

from backend.ai.ai import router as ai_router
from backend.ai.ai import warm_ollama
from backend.graph.schema import ensure_schema
from backend.graph_db import (
    GraphUnavailable,
    check_connectivity,
    close_driver,
    get_driver,
)

app = FastAPI(
        title = "Treenotes APi",
        version = "0.1.0",
        description = "backend api test"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = [
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

DEV_SESSION_SECRET = "dev-only-insecure-session-secret"
SESSION_SECRET = os.getenv("SESSION_SECRET", DEV_SESSION_SECRET)
if SESSION_SECRET == DEV_SESSION_SECRET:
    logging.getLogger("uvicorn.error").warning(
        "SESSION_SECRET is unset; falling back to the insecure development "
        "default. Set a real secret before deploying."
    )

app.add_middleware(
    SessionMiddleware,
    secret_key = SESSION_SECRET,
    session_cookie = "treenotes_session",
    # The frontend reaches the API same-origin through nginx, so lax is
    # sufficient and avoids the SameSite=None; Secure requirement that
    # cross-origin credentialed requests would impose over plain http.
    same_site = "lax",
    https_only = False,
)

# A missing or unreachable graph store is a degraded stack, not a broken
# request. 503 tells the caller to retry; a bare exception would surface as a
# 500 and read as a bug in the endpoint.
@app.exception_handler(GraphUnavailable)
def graph_unavailable_handler(request: Request, exc: GraphUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": f"Graph store unavailable: {exc}"},
    )


def _postgres_ok() -> bool:
    """Round-trip a trivial query. Never raises."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logging.getLogger("uvicorn.error").warning("Postgres health check failed: %s", exc)
        return False


def _health_response() -> JSONResponse:
    """Report each store separately.

    The two are not equally fatal, so they do not get the same status code:

    - Postgres down is unhealthy. Nothing works without it, and a 200 here
      would keep a broken instance in a load balancer.
    - Neo4j down is degraded, not unhealthy. Notes still load, save and render;
      only the graph is unavailable. Reporting the whole API as down over that
      would take out working functionality.
    """
    postgres_ok = _postgres_ok()
    graph_ok = check_connectivity()

    if not postgres_ok:
        status_text, code = "unhealthy", 503
    elif not graph_ok:
        status_text, code = "degraded", 200
    else:
        status_text, code = "ok", 200

    return JSONResponse(
        status_code=code,
        content={
            "status": status_text,
            "databases": {
                "postgres": "ok" if postgres_ok else "unavailable",
                "neo4j": "ok" if graph_ok else "unavailable",
            },
        },
    )


@app.get("/health", tags=["meta"])
def health() -> JSONResponse:
    return _health_response()

# Same payload as /health, but reachable through the nginx proxy, which only
# forwards paths under /api. Use this to smoke test the browser-to-backend path.
@app.get("/api/health", tags=["meta"])
def api_health() -> JSONResponse:
    return _health_response()

@app.on_event("startup") # warm load the Ollama model on startup
def on_startup():
    _init_graph_schema()

    if os.getenv("AI_WARMUP", "true").lower() != "true":
        return
    try:
        warm_ollama()
    except Exception as exc:
        # An unreachable or still-loading Ollama must not stop the API from
        # serving: every other route would go down with it.
        logging.getLogger("uvicorn.error").warning("Ollama warm-up skipped: %s", exc)


def _init_graph_schema() -> None:
    """Apply Neo4j constraints and indexes, tolerating an absent Neo4j.

    Same shape as the Ollama warm-up below and for the same reason: an
    unreachable dependency must not stop the API from serving every route that
    does not need it. The statements are idempotent, so a later boot fixes a
    startup that happened before Neo4j was ready.
    """
    try:
        with get_driver().session() as session:
            ensure_schema(session)
    except Exception as exc:
        logging.getLogger("uvicorn.error").warning(
            "Neo4j schema init skipped: %s", exc
        )


@app.on_event("shutdown")
def on_shutdown():
    close_driver()

# Mounted under /api because the frontend issues same-origin relative calls to
# /api/*, which nginx forwards here with the prefix intact.
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(profile.router, prefix="/api", tags=["profile"])
app.include_router(ai_adapter.router, prefix="/api", tags=["ai-adapter"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
# Shares the /api/notes prefix with the CRUD router above. The path templates
# do not overlap - /{note_id} vs /{note_id}/graph - so ordering does not matter.
app.include_router(note_graph.router, prefix="/api/notes", tags=["note-graph"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(ai_router)
