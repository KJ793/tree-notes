from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, computed_field

class NoteBase(BaseModel):
    title: str
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False
    group_id: Optional[int] = None


# content is declared on the write models rather than on NoteBase, because
# NoteResponse already exposes content as a computed field and the two would
# collide. It is a write-side alias for notes_section so the frontend can use
# one field name in both directions; an explicit notes_section takes priority.
class NoteCreate(NoteBase):
    content: Optional[str] = None

class NoteUpdate(NoteBase):
    title: Optional[str] = None
    cue_section: Optional[str] = None
    notes_section: Optional[str] = None
    summary_section: Optional[str] = None
    is_node: bool = False
    content: Optional[str] = None

class NoteResponse(NoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def content(self) -> str:
        """NoteWorkspace.jsx reads note.content as one body string, while the
        model splits the note into cue/notes/summary sections. Empty string
        rather than null so the editor can bind to it directly."""
        return self.notes_section or ""


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


class UserPublic(BaseModel):
    id: int
    email: str
    # The frontend reads this as "name"; the column is called username.
    name: str


class LoginResponse(BaseModel):
    # Nested under "user" because that is the shape Login.jsx documents.
    user: UserPublic


class ProfileResponse(BaseModel):
    fullName: str
    displayName: str
    email: str
    # Never null: ProfileContent.jsx calls profile.bio.length without a guard
    # and would crash the render.
    bio: str
    memberSince: str


class ProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    displayName: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None


class ProfileUpdateResponse(BaseModel):
    # The component gates on result?.success rather than the status code, so a
    # bare updated profile would read as a failure even on a 200.
    success: bool
    profile: ProfileResponse


class PasswordChangeRequest(BaseModel):
    oldPassword: str
    newPassword: str


class NavbarResponse(BaseModel):
    displayName: str
    initials: str
    profileImage: Optional[str] = None


class RawNotesRequest(BaseModel):
    rawNotes: str
    # The AI functions accept these too, but GraphPanel and SummaryPanel send
    # only rawNotes today. Defaulted so the panels work now, and so the My
    # Summary tab can start sending userSummary without a backend change.
    graphJson: str = ""
    userSummary: str = ""


class SummaryResponse(BaseModel):
    # Both fields carry the same text. SummaryPanel originally read
    # data.summary and now reads data.aiSummary, so returning both means
    # either works and neither side has to coordinate a rename.
    summary: str
    aiSummary: str
    userSummaryReview: str = ""
    userScore: int = 0