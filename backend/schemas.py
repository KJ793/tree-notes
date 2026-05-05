from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

class NoteBase(BaseModel):
    title: str
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False


class NoteCreate(NoteBase):
    pass

class NoteUpdate(NoteBase):
    title: Optional[str] = None
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False

class NoteResponse(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)