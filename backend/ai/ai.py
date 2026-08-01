from typing import TypedDict, cast

import requests, json
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])


class GenerateRequest(BaseModel):
    prompt: str


class OllamaResponse(TypedDict):
    response: str


class Relationship(TypedDict):
    target_id: int
    relationship: str
    weight: float


class Concept(TypedDict):
    concept_id: int
    concept_name: str
    importance: float
    relationships: list[Relationship]


class ConceptGraphResponse(TypedDict):
    concepts: list[Concept]


### Simple Prompts for use in Frontend Testing

# Roses grow best in sunny gardens. Bees are attracted to their bright colors and sweet fragrance. When bees visit roses, they help pollinate the flowers, allowing new blooms to form. Without enough sunlight or pollination, roses struggle to grow strong and healthy.

# Cacti store water in their thick stems to survive in hot deserts. Their spines protect them from animals and help reduce water loss. When rainfall occurs, cacti absorb moisture quickly, allowing them to grow new stems. Without enough sunlight, cacti become weak and struggle to thrive.

# Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.


concept_extraction_template = """
You are an AI that extracts concepts and relationships from text.

Return ONLY valid JSON matching this EXACT schema:

```json
{
  "concepts": [
    {
      "concept_id": int,
      "concept_name": str,
      "importance": float,
      "relationships": [
        {
          "target_id": int,
          "relationship": str,
          "weight": float
        }
      ]
    }
  ]
}
```

Concept Importance is a type of score and must reflect:
- centrality in the text
- number and strength of relationships
- causal significance
- semantic relevance

Relationship Weight is a type of score and must reflect:
- strength of the relationships as express in the text
- clarity of causation or dependency
- contextual certainty
- narrative importance

Rules:
- concept_id must be sequential integers starting at 1
- concept_name must be derived verbatim from the text and the shortest possible noun phrase in snake_case
- relationships must reference valid concept_ids
- relationships cannot be the same or similar to any concept_name
- relationship phrases must be compressed into concise action verbs in snake_case. Examples:
-- "flows from the crater" -> "flow_from_crater"
-- "affecting air quality" -> "affect_air_quality"
-- "protect from animals with spines" -> "protects_from_animals"
- importance and weight must be floats between 0 and 1
- importance and weight must reflect the strength of the four listed properties, normalised between 0 and 1
- use the full range of 0 to 1 for importance and weight
- high scores (0.7-1) should only be used for very strong, explicit relationships
- moderate scores (0.4-0.6) should be used for typical relationships
- low scores (0.0-0.3) should be used for weak or implied relationships
- do NOT include explanations or commentary
- output ONLY in the JSON format as given

Example of correct concept extraction:
Text: "Bees collect nectar from flowers. Nectar helps bees produce honey. Flowers rely on bees for pollination."
JSON:
{
  "concepts": [
    {
      "concept_id": 1,
      "concept_name": "bees",
      "importance": 0.8,
      "relationships": [
        {
          "target_id": 2,
          "relationships": "collect_nectar",
          "weight": 0.6
        },
        {
          "target_id": 3,
          "relationships": "produce_honey",
          "weight": 0.5
        },
      ]
    },
    {
      "concept_id": 2,
      "concept_name": "flowers",
      "importance": 0.7,
      "relationships": [
        {
          "target_id": 1,
          "relationships": "provide_nectar",
          "weight": 0.6
        },
        {
          "target_id": 3,
          "relationships": "enable_pollination",
          "weight": 0.7
        },
      ]
    },
    {
      "concept_id": 3,
      "concept_name": "nectar",
      "importance": 0.6,
      "relationships": [
        {
          "target_id": 1,
          "relationships": "used_for_honey",
          "weight": 0.5
        }
      ]
    }
  ]
}

Your Text to analyse:
"""

def generate_graph(prompt: str) -> str:
    url = "http://treenotes_ollama:11434/api/generate"
    developed_prompt = concept_extraction_template + "\n<<<\n" + prompt + "\n>>>"

    payload = {
        "model": "qwen2.5-coder",
        "prompt": developed_prompt,
        "stream": False
    }

    r = requests.post(url, json=payload)
    r.raise_for_status()

    data = r.json()

    parsed = json.loads(data.get("response", "").strip().replace("```json", "").replace("```", "").strip())

    return cast(ConceptGraphResponse, parsed)

@router.post("/generate")
def generate(req: GenerateRequest):
	print("Backend received prompt:", req.prompt)
    output = generate_graph(req.prompt)
    print("Backend returning output:", output)
    return {"output": output}


def generate_summary(prompt: str) -> str:
    url = "http://treenotes_ollama:11434/api/generate"
    payload = {"model": "phi3.5", "prompt": prompt, "stream": False}

    r = requests.post(url, json=payload)
    r.raise_for_status()

    data = cast(OllamaResponse, r.json())
    return data["response"]

@router.post("/summarise")
def summarise(req: GenerateRequest):
    output = generate_summary(req.prompt)
    return {"output": output}
