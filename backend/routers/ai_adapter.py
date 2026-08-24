"""Adapters between the frontend's /api/* contract and backend/ai/ai.py.

The AI module is owned by another team member and is deliberately not modified
here. It exposes its own routes under /ai/* for direct testing; these endpoints
exist because the frontend calls different paths and parses different keys.

Everything in this file is path and shape translation. No prompts, no model
configuration.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from backend.ai.ai import generate_graph, generate_summary
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import RawNotesRequest, SummaryResponse

router = APIRouter()


def _humanise(value: str) -> str:
    """Concept names and relationships come back in snake_case per the prompt
    template. Cytoscape renders them as-is, so convert for display."""
    return (value or "").replace("_", " ").strip()


def _relationship_label(relationship: Dict[str, Any]) -> str:
    # The prompt template declares "relationship" but its worked example emits
    # "relationships", so the model produces either. See FLAG 005.
    raw = relationship.get("relationship") or relationship.get("relationships")
    return _humanise(raw if isinstance(raw, str) else "")


def _to_cytoscape(concepts: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Map the AI concept schema onto the element shape GraphPanel renders."""
    nodes: List[Dict[str, Any]] = []
    node_ids = set()

    for concept in concepts:
        concept_id = concept.get("concept_id")
        if concept_id is None:
            continue

        node_id = str(concept_id)
        if node_id in node_ids:
            continue

        node_ids.add(node_id)
        nodes.append({
            "data": {
                "id": node_id,
                "label": _humanise(concept.get("concept_name", "")),
                "importance": concept.get("importance"),
            }
        })

    edges: List[Dict[str, Any]] = []
    seen_pairs = set()

    for concept in concepts:
        source = concept.get("concept_id")
        if source is None:
            continue

        source_id = str(source)
        for relationship in concept.get("relationships") or []:
            target = relationship.get("target_id")
            if target is None:
                continue

            target_id = str(target)
            # Cytoscape throws if an edge names an endpoint that is not in the
            # element list, and the model does emit target_ids for concepts it
            # never defined. Dropping those is the difference between a graph
            # that renders and a panel that dies.
            if source_id not in node_ids or target_id not in node_ids:
                continue

            pair = (source_id, target_id)
            if pair in seen_pairs:
                continue

            seen_pairs.add(pair)
            edges.append({
                "data": {
                    "id": f"e{source_id}-{target_id}",
                    "source": source_id,
                    "target": target_id,
                    "label": _relationship_label(relationship),
                    "weight": relationship.get("weight"),
                }
            })

    return {"nodes": nodes, "edges": edges}


def _require_notes(raw_notes: str) -> str:
    text = (raw_notes or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="rawNotes cannot be empty",
        )
    return text


@router.post("/graph")
def graph(
        payload: RawNotesRequest,
        current_user: User = Depends(get_current_user),
) -> Dict[str, List[Dict[str, Any]]]:
    text = _require_notes(payload.rawNotes)

    try:
        result = generate_graph(text)
    except Exception as exc:
        # The panels only branch on response.ok, so an upstream failure has to
        # be a non-2xx status. A 200 carrying an error body would render as an
        # empty graph with no message.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Graph generation failed: {exc}",
        )

    concepts = (result or {}).get("concepts")
    if not isinstance(concepts, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Graph generation returned an unexpected shape",
        )

    return _to_cytoscape(concepts)


@router.post("/summary", response_model=SummaryResponse)
def summary(
        payload: RawNotesRequest,
        current_user: User = Depends(get_current_user),
) -> SummaryResponse:
    text = _require_notes(payload.rawNotes)

    try:
        # generate_summary requires all three arguments. SummaryPanel sends
        # only rawNotes, so the other two are supplied from the schema
        # defaults; without them the request would 422 before reaching Ollama.
        result = generate_summary(text, payload.graphJson, payload.userSummary)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Summary generation failed: {exc}",
        )

    result = result or {}
    text = result.get("aiSummary", "")
    return SummaryResponse(
        summary=text,
        aiSummary=text,
        userSummaryReview=result.get("userSummaryReview", ""),
        userScore=result.get("userScore", 0),
    )
