from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_current_session, get_db_optional
from models.schemas import CreateAgentTaskRequest, ScheduledJobResponse
from routers.schedule import _job_to_response
from services.chat_persist import get_owned_conversation, resolve_db_user_id
from services.schedule_service import create_agent_task_job
from services.session_store import UserSession

router = APIRouter(prefix="/agent-tasks", tags=["agent-tasks"])


@router.post("", response_model=ScheduledJobResponse)
async def create_background_agent_task(
    body: CreateAgentTaskRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ScheduledJobResponse:
    """Queue `run_chat` on the worker; SMS when done if phone on file; optional conversation append."""
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user record — sign out and sign in again after enabling the database.",
        )

    conv_uuid: uuid.UUID | None = None
    if body.conversation_id is not None:
        conv = await get_owned_conversation(
            db, user_id=user_id, conversation_id=body.conversation_id
        )
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        conv_uuid = body.conversation_id

    run_at = datetime.now(timezone.utc) + timedelta(seconds=15)
    try:
        job = await create_agent_task_job(
            db,
            user_id=user_id,
            run_at=run_at,
            instruction=body.instruction,
            conversation_id=conv_uuid,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return _job_to_response(job)
