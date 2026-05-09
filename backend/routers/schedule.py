from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_current_session, get_db_optional
from models.schemas import (
    ScheduleGmailRequest,
    ScheduledJobListResponse,
    ScheduledJobResponse,
)
from services.chat_persist import resolve_db_user_id
from services.schedule_service import cancel_job_if_owned, create_send_gmail_job, list_jobs_for_user
from services.session_store import UserSession

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _job_to_response(job) -> ScheduledJobResponse:
    payload = job.payload_json or {}
    hint: str | None = None
    if (job.job_type or "") == "send_gmail":
        subj = payload.get("subject")
        hint = str(subj)[:120] if subj else None
    else:
        ins = payload.get("instruction")
        hint = str(ins)[:120] if ins else None
    return ScheduledJobResponse(
        id=job.id,
        job_type=job.job_type,
        run_at=job.run_at,
        status=job.status,
        subject_hint=hint,
    )


@router.post("/gmail", response_model=ScheduledJobResponse)
async def schedule_gmail_send(
    body: ScheduleGmailRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ScheduledJobResponse:
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
    try:
        job = await create_send_gmail_job(
            db,
            user_id=user_id,
            run_at=body.run_at,
            to=body.to,
            subject=body.subject,
            body=body.body,
            thread_id=body.thread_id,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _job_to_response(job)


@router.get("/jobs", response_model=ScheduledJobListResponse)
async def list_my_jobs(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> ScheduledJobListResponse:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        return ScheduledJobListResponse(jobs=[])
    rows = await list_jobs_for_user(db, user_id=user_id)
    return ScheduledJobListResponse(jobs=[_job_to_response(j) for j in rows])


@router.post("/jobs/{job_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_my_job(
    job_id: uuid.UUID,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> None:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    ok = await cancel_job_if_owned(db, user_id=user_id, job_id=job_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    await db.commit()
