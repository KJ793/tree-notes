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


def call_phi35(prompt: str) -> str:  # this function returns a string datatype
    model = "phi3.5"
    url = "http://host.docker.internal:11434/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}

    r = requests.post(url, json=payload)
    r.raise_for_status()  # confirm HTTP status code good: 200-299; bad:400+ and will raise exception HTTPError

    # cast the response .json() dict with structure of OllamaResponse class -> avoid ambiguity of type Any
    data = cast(OllamaResponse, r.json())

    return data["response"]


@router.post("/generate")
def generate(req: GenerateRequest):
    output = call_phi35(req.prompt)
    return {"output": output}
