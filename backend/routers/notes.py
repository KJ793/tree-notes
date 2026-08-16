from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Note
from schemas import NoteCreate, NoteResponse, NoteUpdate

DEV_USER_ID = 1

router = APIRouter()

@router.post(
    "/",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)

def create_note(payload: NoteCreate, db: Session = Depends(get_db)) -> Note:
    note = Note(**payload.model_dump(), user_id = DEV_USER_ID)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/", response_model=List[NoteResponse])
def list_notes(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
) -> List[Note]:
    return (
        db.query(Note)
        .filter(Note.user_id == DEV_USER_ID)
        .order_by(Note.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{note_id}", response_model=NoteResponse)
def read_note(note_id: int, db: Session = Depends(get_db)) -> Note:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == DEV_USER_ID)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Note id of {note_id} not found",
        )
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
def update_note(
        note_id: int,
        payload: NoteUpdate,
        db: Session = Depends(get_db),
) -> Note:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == DEV_USER_ID)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Note id of {note_id} not found",
        )
    changes = payload.model_dump(exclude_unset = True)
    for field, value in changes.items():
        setattr(note, field, value)

    note.updated_at = datetime.now()

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.user_id == DEV_USER_ID)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "Note id of {note_id} not found",
        )
    db.delete(note)
    db.commit()