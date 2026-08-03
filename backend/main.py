from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.ai.ai import router as ai_router
from backend.ai.ai import warm_ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}

@app.on_event("startup") # warm load the Ollama model on startup
def on_startup():
    warm_ollama()
