from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Note, User
from backend.schemas import NoteCreate, NoteResponse, NoteUpdate

router = APIRouter()

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
