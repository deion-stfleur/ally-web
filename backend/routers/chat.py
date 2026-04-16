from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_current_session, get_db_optional
from db.models import Conversation
from models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatStateResponse,
    ChatHistoryMessage,
    ConversationListResponse,
    ConversationSummary,
    EmailActionPayload,
    ScheduleEmailActionPayload,
    ScheduledJobResponse,
)
from services.claude_service import run_chat
from services.chat_persist import (
    append_pair,
    create_conversation,
    get_owned_conversation,
    list_conversation_summaries,
    load_conversation_messages,
    load_latest_state,
    resolve_db_user_id,
)
from services.schedule_service import create_send_gmail_job
from services.session_store import UserSession

logger = logging.getLogger(__name__)


def _parse_run_at_iso(s: str) -> datetime:
    raw = s.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _job_to_chat_response(job) -> ScheduledJobResponse:
    payload = job.payload_json or {}
    subj = payload.get("subject")
    hint = str(subj)[:120] if subj else None
    return ScheduledJobResponse(
        id=job.id,
        job_type=job.job_type,
        run_at=job.run_at,
        status=job.status,
        subject_hint=hint,
    )

router = APIRouter(prefix="/chat", tags=["chat"])


def _title_from_message(text: str) -> str | None:
    t = text.strip().replace("\n", " ")
    if not t:
        return None
    return (t[:200] + "…") if len(t) > 200 else t


def _conversation_display_title(conv: Conversation) -> str:
    t = (conv.title or "").strip()
    if t:
        return t
    return "Chat"


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ConversationListResponse:
    if db is None:
        return ConversationListResponse(conversations=[])
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        return ConversationListResponse(conversations=[])
    rows = await list_conversation_summaries(db, user_id=user_id, limit=100)
    return ConversationListResponse(
        conversations=[
            ConversationSummary(
                conversation_id=str(c.id),
                title=_conversation_display_title(c),
                updated_at=c.updated_at,
            )
            for c in rows
        ],
    )


@router.get("/conversations/{conversation_id}", response_model=ChatStateResponse)
async def get_conversation_state(
    conversation_id: uuid.UUID,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ChatStateResponse:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    _conv, msgs = await load_conversation_messages(
        db, user_id=user_id, conversation_id=conversation_id
    )
    if _conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    out: list[ChatHistoryMessage] = []
    for m in msgs:
        if m.role == "user":
            out.append(ChatHistoryMessage(role="user", content=m.content))
        elif m.role == "assistant":
            out.append(ChatHistoryMessage(role="assistant", content=m.content))
    return ChatStateResponse(
        conversation_id=str(conversation_id),
        messages=out,
    )


@router.get("/state", response_model=ChatStateResponse)
async def chat_state(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ChatStateResponse:
    if db is None:
        return ChatStateResponse()
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        return ChatStateResponse()
    cid, msgs = await load_latest_state(db, user_id=user_id)
    out: list[ChatHistoryMessage] = []
    for m in msgs:
        if m.role == "user":
            out.append(ChatHistoryMessage(role="user", content=m.content))
        elif m.role == "assistant":
            out.append(ChatHistoryMessage(role="assistant", content=m.content))
    return ChatStateResponse(
        conversation_id=str(cid) if cid else None,
        messages=out,
    )


@router.post("", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ChatResponse:
    history = [m.model_dump() for m in body.history]
    try:
        reply, action_dict = await run_chat(
            body.message,
            history,
            session.credentials,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Claude request failed: {exc!s}",
        ) from exc

    email_action = None
    schedule_payload: ScheduleEmailActionPayload | None = None
    if action_dict:
        act = action_dict.get("action")
        if act == "send_email":
            try:
                email_action = EmailActionPayload.model_validate(action_dict)
            except ValidationError:
                email_action = None
        elif act == "schedule_email":
            try:
                schedule_payload = ScheduleEmailActionPayload.model_validate(action_dict)
            except ValidationError:
                schedule_payload = None

    text = (reply or "").strip() or " "
    out_cid: str | None = None
    scheduled_job: ScheduledJobResponse | None = None

    if db is not None:
        user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
        if user_id is not None:
            try:
                conv = None
                if body.conversation_id is not None:
                    conv = await get_owned_conversation(
                        db, user_id=user_id, conversation_id=body.conversation_id
                    )
                    if conv is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Conversation not found.",
                        )
                else:
                    conv = await create_conversation(
                        db,
                        user_id=user_id,
                        title=_title_from_message(body.message),
                    )
                await append_pair(
                    db,
                    conversation=conv,
                    user_text=body.message,
                    assistant_text=text,
                )
                if schedule_payload is not None:
                    try:
                        run_at = _parse_run_at_iso(schedule_payload.run_at)
                        job = await create_send_gmail_job(
                            db,
                            user_id=user_id,
                            run_at=run_at,
                            to=schedule_payload.to,
                            subject=schedule_payload.subject,
                            body=schedule_payload.body,
                            thread_id=schedule_payload.thread_id,
                        )
                        scheduled_job = _job_to_chat_response(job)
                    except (ValueError, ValidationError) as exc:
                        text = f"{text}\n\n(Scheduling failed: {exc})"
                    except Exception:
                        logger.exception("Scheduled email job creation failed")
                        text = f"{text}\n\n(Scheduling failed: could not create job.)"
                await db.commit()
                out_cid = str(conv.id)
            except HTTPException:
                await db.rollback()
                raise
            except Exception:
                await db.rollback()
                logger.exception("Chat DB persist failed (reply still returned)")
                out_cid = None
                scheduled_job = None

    return ChatResponse(
        reply=text,
        email_action=email_action,
        scheduled_job=scheduled_job,
        conversation_id=out_cid,
    )
