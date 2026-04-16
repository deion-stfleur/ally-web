from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class GoogleAuthRequest(BaseModel):
    """Authorization code from Google Identity Services or redirect OAuth."""

    code: str = Field(..., min_length=1)
    redirect_uri: str | None = Field(
        default=None,
        description="Must match the redirect_uri used when the code was issued "
        "(e.g. GIS popup often uses 'postmessage'). Defaults to GOOGLE_REDIRECT_URI.",
    )


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    phone_e164: str | None = None


class UpdatePhoneRequest(BaseModel):
    """Digits or +E.164; server normalizes to E.164."""

    phone: str = Field(..., min_length=7, max_length=32)


class ChatMessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
    history: list[ChatMessageItem] = Field(default_factory=list, max_length=50)
    conversation_id: UUID | None = Field(
        default=None,
        description="Omit or null to start a new thread when persisting to Postgres.",
    )


class EmailActionPayload(BaseModel):
    """Parsed from Claude <action> block when action is send_email."""

    action: Literal["send_email"]
    to: str = Field(..., min_length=3, max_length=500)
    subject: str = Field(..., max_length=500)
    body: str = Field(..., max_length=50000)
    thread_id: str | None = Field(default=None, max_length=128)


class ScheduleEmailActionPayload(BaseModel):
    """Parsed from Claude <action> block when action is schedule_email."""

    action: Literal["schedule_email"]
    run_at: str = Field(
        ...,
        min_length=10,
        max_length=64,
        description="RFC3339 instant with timezone, e.g. 2026-02-10T15:00:00Z",
    )
    to: str = Field(..., min_length=3, max_length=500)
    subject: str = Field(..., max_length=500)
    body: str = Field(..., max_length=50000)
    thread_id: str | None = Field(default=None, max_length=128)


class ChatResponse(BaseModel):
    reply: str
    email_action: EmailActionPayload | None = None
    scheduled_job: ScheduledJobResponse | None = Field(
        default=None,
        description="Populated when Claude requests a delayed Gmail send and the job was created.",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Active conversation id when chat persistence is enabled.",
    )


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatStateResponse(BaseModel):
    conversation_id: str | None = None
    messages: list[ChatHistoryMessage] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    """One row for history / search UI."""

    conversation_id: str
    title: str
    updated_at: datetime


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class SendEmailRequest(BaseModel):
    to: str = Field(..., min_length=3, max_length=500)
    subject: str = Field(..., max_length=500)
    body: str = Field(..., max_length=50000)
    thread_id: str | None = Field(default=None, max_length=128)


class SendEmailResponse(BaseModel):
    message_id: str
    thread_id: str | None = None


class GmailThreadRow(BaseModel):
    thread_id: str
    snippet: str


class GmailThreadListResponse(BaseModel):
    threads: list[GmailThreadRow]


class GmailThreadTextResponse(BaseModel):
    text: str


class QuickRequestItem(BaseModel):
    """One Gmail-backed suggestion for the chat composer (right rail)."""

    thread_id: str = Field(..., max_length=128)
    label: str = Field(
        ...,
        min_length=4,
        max_length=90,
        description="Short imperative line shown in the UI.",
    )
    prefill: str = Field(
        ...,
        min_length=12,
        max_length=700,
        description="Clear instruction the user can send to the assistant.",
    )


class QuickRequestsResponse(BaseModel):
    items: list[QuickRequestItem]


class DriveFileRow(BaseModel):
    id: str
    name: str | None = None
    mimeType: str | None = None
    modifiedTime: str | None = None


class DriveFileListResponse(BaseModel):
    files: list[DriveFileRow]


class DriveFileTextResponse(BaseModel):
    file_id: str
    text: str


class CreateDocRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=5000)
    initial_text: str = Field(default="", max_length=500_000)


class AppendDocRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500_000)


class ReplaceDocBodyRequest(BaseModel):
    text: str = Field(default="", max_length=500_000)


class DocWriteResponse(BaseModel):
    document_id: str
    url: str


class DocOkResponse(BaseModel):
    ok: bool = True
    document_id: str
    url: str


class ScheduleGmailRequest(BaseModel):
    """Queue a Gmail send at run_at (server stores job; worker must be running)."""

    run_at: datetime = Field(
        ...,
        description="ISO-8601 instant with timezone (UTC recommended).",
    )
    to: str = Field(..., min_length=3, max_length=500)
    subject: str = Field(..., max_length=500)
    body: str = Field(..., max_length=50000)
    thread_id: str | None = Field(default=None, max_length=128)

    @field_validator("run_at")
    @classmethod
    def run_at_must_be_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("run_at must include a timezone (e.g. append Z for UTC).")
        return v.astimezone(timezone.utc)


class ScheduledJobResponse(BaseModel):
    id: UUID
    job_type: str
    run_at: datetime
    status: str
    subject_hint: str | None = None


class ScheduledJobListResponse(BaseModel):
    jobs: list[ScheduledJobResponse]


class UserTodoItem(BaseModel):
    id: UUID
    text: str = Field(default="", max_length=4000)
    done: bool = False

    @field_validator("text", mode="before")
    @classmethod
    def normalize_text(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v)


class UserTodoPut(BaseModel):
    todos: list[UserTodoItem] = Field(default_factory=list, max_length=500)


class UserTodoOut(BaseModel):
    id: UUID
    text: str
    done: bool
    created_at: datetime | None = None


class TodoListResponse(BaseModel):
    todos: list[UserTodoOut]
