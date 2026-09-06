import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.graph import repository as graph_repository
from backend.graph_db import get_driver
from backend.models import Note, User
from backend.schemas import NoteCreate, NoteResponse, NoteUpdate

router = APIRouter()

log = logging.getLogger("uvicorn.error")


def _purge_graph(user_id: int, note_id: int) -> None:
    """Best-effort removal of a deleted note's subgraph.

    Deliberately not a FastAPI dependency: `get_graph` raises when Neo4j is
    unreachable, which would make note deletion fail because a *secondary*
    store is down. Postgres is authoritative for whether a note exists, so the
    row goes first and this is allowed to fail.

    A failure here leaves an orphaned subgraph, which is what the reconcile
    routine in backend/graph/reconcile.py is for.
    """
    try:
        with get_driver().session() as session:
            graph_repository.delete_note_graph(session, user_id, note_id)
    except Exception as exc:
        log.warning("Graph cleanup skipped for note %s: %s", note_id, exc)

@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
        payload: NoteCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    fields = payload.model_dump()
    content = fields.pop("content", None)
    if content is not None and fields.get("notes_section") is None:
        fields["notes_section"] = content

    note = Note(**fields, user_id = current_user.id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("", response_model=List[NoteResponse])
def list_notes(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> List[Note]:
    return (
        db.query(Note)
        .filter(Note.user_id == current_user.id)
        .order_by(Note.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{note_id}", response_model=NoteResponse)
def read_note(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = f"Note id of {note_id} not found",
        )
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
        note_id: int,
        payload: NoteUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> Note:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = f"Note id of {note_id} not found",
        )
    changes = payload.model_dump(exclude_unset = True)
    # content is an alias, not a column. Redirect it before the setattr loop,
    # which would otherwise hang a stray attribute off the ORM object that
    # never reaches the database.
    content = changes.pop("content", None)
    if content is not None and "notes_section" not in changes:
        changes["notes_section"] = content

    for field, value in changes.items():
        setattr(note, field, value)

    note.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
        note_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
) -> None:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = f"Note id of {note_id} not found",
        )
    db.delete(note)
    db.commit()

    # Postgres first, then the graph. If this order were reversed and the
    # Postgres delete failed, the note would survive with its graph destroyed.
    _purge_graph(current_user.id, note_id)
