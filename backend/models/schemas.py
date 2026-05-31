from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

import base64

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


class AppConfigResponse(BaseModel):
    """Public client config (no secrets)."""

    ally_sms_e164: str | None = None


class UserMeResponse(BaseModel):
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    phone_e164: str | None = None
    default_receipts_spreadsheet_id: str | None = None
    default_receipts_sheet_range: str | None = None
    receipts_confirm_before_append: bool = True
    sms_plan_active: bool = False
    stripe_subscription_status: str | None = None
    subscription_plan: Literal["starter", "pro"] | None = None


class CheckoutSessionRequest(BaseModel):
    plan: Literal["starter", "pro"] = Field(
        ...,
        description="starter ($19.99/mo) or pro ($49.99/mo)",
    )


class CheckoutSessionResponse(BaseModel):
    url: str


class BillingPortalResponse(BaseModel):
    url: str


class ReceiptSettingsPatch(BaseModel):
    """PATCH body; omit a field to leave it unchanged."""

    default_receipts_spreadsheet_id: str | None = Field(
        default=None,
        max_length=128,
        description="Google Sheet ID from the spreadsheet URL; empty string clears.",
    )
    default_receipts_sheet_range: str | None = Field(
        default=None,
        max_length=256,
        description="A1 range for append, e.g. Sheet1!A:Z",
    )
    receipts_confirm_before_append: bool | None = Field(
        default=None,
        description="If true, Ally asks before appending a receipt row.",
    )


class UpdatePhoneRequest(BaseModel):
    """Digits or +E.164; server normalizes to E.164."""

    phone: str = Field(..., min_length=7, max_length=32)


class PhoneAuthRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)


class PhoneAuthVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)
    code: str = Field(..., min_length=4, max_length=12)


class OpenTableConnectRequest(BaseModel):
    """Client submits OpenTable credentials for initial connect (not stored)."""

    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=1, max_length=320)


class OpenTableMfaRequest(BaseModel):
    """If connect requires MFA, client submits the code."""

    code: str = Field(..., min_length=4, max_length=16)


class ChatMessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class ChatImagePart(BaseModel):
    """One inline image for Claude vision (receipts, screenshots)."""

    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    data_base64: str = Field(..., min_length=8, max_length=12_000_000)

    @field_validator("data_base64")
    @classmethod
    def validate_image_size(cls, v: str) -> str:
        try:
            raw = base64.b64decode(v, validate=True)
        except Exception as exc:
            raise ValueError("Invalid base64 image data") from exc
        if len(raw) > 5_500_000:
            raise ValueError("Image too large after decode (max ~5.5MB)")
        return v


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
    history: list[ChatMessageItem] = Field(default_factory=list, max_length=50)
    conversation_id: UUID | None = Field(
        default=None,
        description="Omit or null to start a new thread when persisting to Postgres.",
    )
    images: list[ChatImagePart] = Field(
        default_factory=list,
        max_length=4,
        description="Optional receipt/screenshot images as base64.",
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


class BackgroundTaskActionPayload(BaseModel):
    """Parsed from Claude <action> block when action is background_task."""

    action: Literal["background_task"]
    instruction: str = Field(..., min_length=1, max_length=12000)


class BrowserTaskActionPayload(BaseModel):
    """Parsed from Claude <action> when a Pro user needs real browser automation."""

    action: Literal["browser_task"]
    task: str = Field(..., min_length=1, max_length=12000)
    start_url: str | None = Field(default=None, max_length=2048)


class CreateAgentTaskRequest(BaseModel):
    """Queue a background agent run (same worker as scheduled Gmail)."""

    instruction: str = Field(..., min_length=1, max_length=12000)
    conversation_id: UUID | None = Field(
        default=None,
        description="Optional: append result to this chat when the job finishes.",
    )


class CreateWatchRuleRequest(BaseModel):
    """SMS watch on a topic (daily briefing or instant push polling)."""

    spec_text: str = Field(..., min_length=1, max_length=8000)
    time_local: str | None = Field(
        default=None,
        max_length=5,
        description="HH:MM 24h in timezone; default 09:00 if omitted (daily mode).",
    )
    timezone: str | None = Field(
        default=None,
        max_length=64,
        description="IANA zone, e.g. America/Los_Angeles; default America/New_York if omitted.",
    )
    watch_mode: Literal["daily", "instant"] | None = Field(
        default=None,
        description="daily = once per day at time_local; instant = poll every ~15 min, text on change.",
    )
    poll_interval_minutes: int | None = Field(
        default=None,
        ge=5,
        le=60,
        description="Instant mode only: minutes between checks (default 15).",
    )


class WatchRuleOut(BaseModel):
    id: UUID
    spec_text: str
    time_local: str
    timezone: str
    status: str
    watch_mode: str = "daily"
    poll_interval_minutes: int = 15
    next_run_at: datetime


class WatchRuleStatusPatch(BaseModel):
    status: Literal["active", "paused"]


class RegisterWatchActionPayload(BaseModel):
    """Parsed from Claude <action> when user sets an SMS watch."""

    action: Literal["register_watch"]
    spec: str = Field(..., min_length=1, max_length=8000)
    time_local: str | None = Field(default=None, max_length=5)
    timezone: str | None = Field(default=None, max_length=64)
    mode: Literal["daily", "instant"] | None = Field(
        default=None,
        description="instant = push when the topic changes; daily = once per day.",
    )
    poll_interval_minutes: int | None = Field(default=None, ge=5, le=60)


class EnableMeetingAutoJoinActionPayload(BaseModel):
    action: Literal["enable_meeting_auto_join"]


class DisableMeetingAutoJoinActionPayload(BaseModel):
    action: Literal["disable_meeting_auto_join"]


class ChatResponse(BaseModel):
    reply: str
    email_action: EmailActionPayload | None = None
    scheduled_job: ScheduledJobResponse | None = Field(
        default=None,
        description="Populated when Claude requests a delayed Gmail send and the job was created.",
    )
    background_job: ScheduledJobResponse | None = Field(
        default=None,
        description="Background agent run queued; worker texts when done if phone on file.",
    )
    browser_job: ScheduledJobResponse | None = Field(
        default=None,
        description="Pro-only Browser Use job queued for Railway worker.",
    )
    watch_rule: WatchRuleOut | None = Field(
        default=None,
        description="Populated when Claude registers a daily SMS watch.",
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
