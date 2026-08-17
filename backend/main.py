"""
to run:
docker compose down -v (wipes database)
docker compose up -d --build
docker compose run backend alembic upgrade head
curl.exe http://localhost:8000/health
http://localhost:8000/docs
verify with:
docker compose run backend alembic current
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import auth, groups, notes

from backend.ai.ai import router as ai_router
from backend.ai.ai import warm_ollama

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

@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}

@app.on_event("startup") # warm load the Ollama model on startup
def on_startup():
    warm_ollama()

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(notes.router, prefix="/notes", tags=["notes"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(ai_router)
