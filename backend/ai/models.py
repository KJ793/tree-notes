from typing import TypedDict
from pydantic import BaseModel

class GenerateGraph(BaseModel):
    rawNotes: str


class SearchGraph(BaseModel):
    search_input: str
    graphJson: str


class GenerateSummary(BaseModel):
    rawNotes: str
    graphJson: str
    userSummary: str


class SummaryResponse(TypedDict):
    userScore: int
    userSummaryReview: str
    aiSummary: str


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
