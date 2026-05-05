"""
to run:
docker compose down -v (wipes database)
docker compose up -d
docker compose run backend alembic upgrade head

verify with:
docker compose run backend alembic current
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import notes

app = FastAPI(
        title = "Treenotes APi",
        version = "0.1.0",
        description = "backend api test"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}

app.include_router(notes.router, prefix="/notes", tags=["notes"])