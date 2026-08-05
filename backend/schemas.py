from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

class NoteBase(BaseModel):
    title: str
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False
    group_id: Optional[int] = None


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


class GroupCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class GroupResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteSummary(BaseModel):
    id: int
    title: str
    group_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LinkCreate(BaseModel):
    note_a_id: int
    note_b_id: int
    label: Optional[str] = None


class LinkResponse(BaseModel):
    id: int
    note_a_id: int
    note_b_id: int
    label: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GraphResponse(BaseModel):
    groups: List[GroupResponse]
    notes: List[NoteSummary]
    links: List[LinkResponse]


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    id: int
    username: str
    email: str