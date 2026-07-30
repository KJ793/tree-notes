from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.ai.ai import router as ai_router

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
