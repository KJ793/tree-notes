"""Persistence for the per-note concept graph.

`GraphPanel` already PUTs to `/api/notes/{id}/graph`; until now nothing served
it. These endpoints close that gap. See FRONTEND_INTEGRATION.md for the
client-side changes needed to actually reach them - the current `saveGraph()`
has no caller, so building this alone does not make the feature work.

Ownership is checked in Postgres before Neo4j is touched. Postgres is
authoritative for whether a note exists; Neo4j only describes its shape.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from neo4j import Session as GraphSession
from neo4j.exceptions import ServiceUnavailable, SessionExpired
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.graph import repository
from backend.graph.projections import cytoscape_to_records, records_to_cytoscape
from backend.graph_db import check_connectivity, get_graph
from backend.models import Note, User
from backend.schemas import CytoscapeGraph

router = APIRouter()

log = logging.getLogger("uvicorn.error")


def _owned_note(db: Session, note_id: int, user_id: int) -> Note:
    """Resolve a note the caller owns, or 404.

    The same 404 is returned for "does not exist" and "belongs to someone
    else", so the endpoint cannot be used to probe which note ids are taken.
    """
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == user_id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note id of {note_id} not found",
        )
    return note


def _graph_error(exc: Exception, action: str, note_id: int) -> HTTPException:
    """Translate a driver failure into the right status code.

    The distinction matters to the caller: 503 means "the graph store is down,
    try again later" and the panel should degrade quietly, while 502 means the
    store was reached and refused the operation, which is a real error worth
    surfacing. The driver connects lazily, so an unreachable Neo4j surfaces
    here at query time rather than when the session was opened.

    Reachability is probed rather than inferred from the exception type. The
    driver's taxonomy does not map cleanly onto the question: an unresolvable
    hostname raises a plain `ValueError`, not `ServiceUnavailable`, so an
    isinstance check alone reports a downed store as a 502. The explicit check
    costs one round trip and only runs on the error path.
    """
    log.warning("Graph %s failed for note %s: %s", action, note_id, exc)

    unreachable = isinstance(exc, (ServiceUnavailable, SessionExpired))
    if not unreachable:
        unreachable = not check_connectivity()

    if unreachable:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Graph store unavailable: {exc}",
        )

    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Graph store {action} failed: {exc}",
    )


# response_model_exclude_none keeps `position` out of the payload entirely when
# a node has no stored coordinates, rather than emitting `position: null`. It
# does not reach inside `data`, which is an untyped dict, so `importance: null`
# and friends are unaffected. The frontend's preset-vs-cose check reads
# `node.position` for truthiness, so an explicit null there is misleading.
@router.put("/{note_id}/graph", response_model=CytoscapeGraph,
            response_model_exclude_none=True)
def save_note_graph(
        note_id: int,
        payload: CytoscapeGraph,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        graph: GraphSession = Depends(get_graph),
) -> dict:
    """Persist the graph and return it as stored.

    The response is the canonical version rather than an acknowledgement, so a
    client that generated its own temporary element ids can adopt the
    server-minted UUIDs without a second request.
    """
    note = _owned_note(db, note_id, current_user.id)

    concepts, relationships = cytoscape_to_records(payload.model_dump())

    try:
        repository.save_note_graph(
            graph,
            user_id=current_user.id,
            note_id=note_id,
            note_title=note.title,
            concepts=concepts,
            relationships=relationships,
        )
    except repository.GraphOwnershipError:
        # The stores disagree about who owns this note: Postgres said the
        # caller does, Neo4j says otherwise. Report the same 404 as a missing
        # note rather than confirming it exists for someone else.
        log.error(
            "Ownership mismatch between stores for note %s (user %s)",
            note_id, current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note id of {note_id} not found",
        )
    except Exception as exc:
        # Record that what is stored no longer matches the note, then fail the
        # request. The note itself is untouched, so no user work is lost.
        note.graph_status = "stale"
        db.commit()
        raise _graph_error(exc, "write", note_id)

    note.graph_status = "ok"
    note.graph_updated_at = datetime.now(timezone.utc)
    db.commit()

    concept_rows, relationship_rows = repository.load_note_graph(
        graph, user_id=current_user.id, note_id=note_id
    )
    return records_to_cytoscape(concept_rows, relationship_rows)


@router.get("/{note_id}/graph", response_model=CytoscapeGraph,
            response_model_exclude_none=True)
def read_note_graph(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        graph: GraphSession = Depends(get_graph),
) -> dict:
    """Return the stored graph, or an empty one if the note has never saved.

    An empty `{nodes: [], edges: []}` is not an error: the note exists, it just
    has no graph yet. The panel renders that as "Graph will appear here".
    """
    _owned_note(db, note_id, current_user.id)

    try:
        concept_rows, relationship_rows = repository.load_note_graph(
            graph, user_id=current_user.id, note_id=note_id
        )
    except Exception as exc:
        raise _graph_error(exc, "read", note_id)

    return records_to_cytoscape(concept_rows, relationship_rows)


@router.delete("/{note_id}/graph", status_code=status.HTTP_204_NO_CONTENT)
def delete_note_graph(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        graph: GraphSession = Depends(get_graph),
) -> None:
    """Discard a note's graph without deleting the note."""
    note = _owned_note(db, note_id, current_user.id)

    try:
        repository.delete_note_graph(
            graph, user_id=current_user.id, note_id=note_id
        )
    except Exception as exc:
        raise _graph_error(exc, "delete", note_id)

    note.graph_status = "none"
    note.graph_updated_at = None
    db.commit()
