from typing import TypedDict, Union
from pydantic import BaseModel

class SearchGraphResult(TypedDict):
    node_id: int
    label: str
    score: float

class SummaryResponse(TypedDict):
    userScore: int
    userSummaryReview: str
    aiSummary: str

class Relationship(TypedDict):
    target_id: int
    relationship: str

class Concept(TypedDict):
    concept_id: int
    concept_name: str
    relationships: list[Relationship]

class ConceptGraphResponse(TypedDict):
    concepts: list[Concept]




class NodeData(TypedDict):
    id: str
    label: str

class EdgeData(TypedDict):
    id: str
    source: str
    target: str
    relationship: str

class NodeEvent(TypedDict):
    type: str # "node"
    data: NodeData

class EdgeEvent(TypedDict):
    type: str # "edge"
    data: EdgeData

class DoneData(TypedDict):
    nodes: int
    edges: int

class DoneEvent(TypedDict):
    type: str # "done"
    stats: DoneData

GraphEvent = Union[NodeEvent, EdgeEvent, DoneEvent]
