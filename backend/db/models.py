from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    pass


class User(Base):
    """App user.

    Phone-first auth supports accounts without Google connected (google_sub NULL).
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(512), nullable=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    google_refresh_token_encrypted: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    google_scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone_e164: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opentable_session_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation",
        back_populates="user",
        foreign_keys="[Conversation.user_id]",
        cascade="all, delete-orphan",
    )
    scheduled_jobs: Mapped[list["ScheduledJob"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    watch_rules: Mapped[list["UserWatchRule"]] = relationship(
        "UserWatchRule",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_todos: Mapped[list["UserTodo"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="UserTodo.sort_order",
    )
    default_receipts_spreadsheet_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    default_receipts_sheet_range: Mapped[str | None] = mapped_column(
        String(256), nullable=True
    )
    receipts_confirm_before_append: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", default=True
    )
    sendblue_conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    sendblue_conversation: Mapped["Conversation | None"] = relationship(
        "Conversation",
        foreign_keys=[sendblue_conversation_id],
        uselist=False,
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stripe_plan: Mapped[str | None] = mapped_column(String(16), nullable=True)
    meeting_calendar_auto_join: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    meeting_auto_join_opt_in_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    profile: Mapped["UserProfile | None"] = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class UserProfile(Base):
    """Interests and proactive-SMS preferences learned from conversations."""

    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    phone_e164: Mapped[str | None] = mapped_column(String(32), nullable=True)
    interests: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    active_hours: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    preferred_update_time: Mapped[str | None] = mapped_column(String(128), nullable=True)
    recent_topics_sent: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        server_default="America/New_York",
        default="America/New_York",
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_proactive_sent: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_memory_extract_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    onboarding_updates_asked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    proactive_awaiting_reply: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="profile")


class SendblueInboundDedupe(Base):
    """Idempotency for Sendblue receive webhooks (message_handle)."""

    __tablename__ = "sendblue_inbound_dedupe"

    message_handle: Mapped[str] = mapped_column(String(160), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PhoneOtpChallenge(Base):
    __tablename__ = "phone_otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone_e164: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UserTodo(Base):
    __tablename__ = "user_todos"
    __table_args__ = (Index("ix_user_todos_user_id_sort", "user_id", "sort_order"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(String(4000), nullable=False)
    done: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="user_todos")


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="pending", index=True
    )
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="scheduled_jobs")


class UserWatchRule(Base):
    """Daily check: worker enqueues an agent SMS job with the spec (MVP)."""

    __tablename__ = "user_watch_rules"
    __table_args__ = (Index("ix_user_watch_rules_status_next_run", "status", "next_run_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    spec_text: Mapped[str] = mapped_column(Text, nullable=False)
    time_local: Mapped[str] = mapped_column(
        String(5), nullable=False, server_default="09:00", default="09:00"
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        server_default="America/New_York",
        default="America/New_York",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="active", default="active"
    )
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    watch_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="daily", default="daily"
    )
    poll_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="15", default=15
    )
    last_digest: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="watch_rules")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(
        back_populates="conversations",
        foreign_keys=[user_id],
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_conversation_id_created_at", "conversation_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class PublishedSite(Base):
    """Multi-file site project (draft + published versions)."""

    __tablename__ = "published_sites"
    __table_args__ = (Index("ix_published_sites_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    html_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_token: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    design_tokens: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    draft_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("site_versions.id", ondelete="SET NULL", use_alter=True, name="fk_published_sites_draft_version"),
        nullable=True,
    )
    published_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("site_versions.id", ondelete="SET NULL", use_alter=True, name="fk_published_sites_published_version"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SiteVersion(Base):
    __tablename__ = "site_versions"
    __table_args__ = (
        Index("ix_site_versions_site_id", "site_id"),
        UniqueConstraint("site_id", "version_number", name="uq_site_versions_site_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("published_sites.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    files: Mapped[list["SiteFile"]] = relationship(
        back_populates="version",
        cascade="all, delete-orphan",
    )


class SiteFile(Base):
    __tablename__ = "site_files"
    __table_args__ = (
        Index("ix_site_files_version_id", "version_id"),
        UniqueConstraint("version_id", "path", name="uq_site_files_version_path"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("site_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    path: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    version: Mapped[SiteVersion] = relationship(back_populates="files")


class MeetingBotJob(Base):
    """Meeting BaaS bot linked to a user (SMS or chat initiated)."""

    __tablename__ = "meeting_bot_jobs"
    __table_args__ = (Index("ix_meeting_bot_jobs_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    external_bot_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    meeting_url: Mapped[str] = mapped_column(Text, nullable=False)
    calendar_event_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    join_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="joined")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    webhook_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class WaitlistSignup(Base):
    """Marketing waitlist while Google OAuth verification is in progress."""

    __tablename__ = "waitlist_signups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    use_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuthSession(Base):
    """Server-side session backing JWT sub (survives Heroku dyno restarts)."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    db_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str | None] = mapped_column(String(512), nullable=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credentials_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
