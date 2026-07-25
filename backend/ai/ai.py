from typing import TypedDict, cast

import requests
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])


class GenerateRequest(BaseModel):
    prompt: str


class OllamaResponse(TypedDict):
    model: str
    created_at: str
    response: str
    done: bool

def call_phi35(prompt: str) -> str:
    model = "phi3.5"
    url = "http://ollama:11434/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}

    r = requrests.post(url, json=payload)
    r.raise_for_status()

    data = cast(OllamaResponse, r.json())
    return data["response"]


@router.post("/generate")
def generate(req: GenerateRequest):
    output = call_phi35(req.prompt)
    return {"output": output}
