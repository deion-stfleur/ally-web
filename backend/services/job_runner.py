from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ScheduledJob, User
from services import gmail_service
from services.google_auth import GOOGLE_TOKEN_URL
from services.google_token_crypto import decrypt_refresh_token
from services.schedule_service import JOB_SEND_GMAIL

logger = logging.getLogger(__name__)


def _credentials_from_user(user: User) -> Credentials | None:
    rt = decrypt_refresh_token(user.google_refresh_token_encrypted)
    if not rt:
        return None
    scopes = (
        user.google_scopes.split() if (user.google_scopes or "").strip() else None
    )
    return Credentials(
        token=None,
        refresh_token=rt,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
    )


async def _claim_next_job_id(session: AsyncSession) -> uuid.UUID | None:
    now = datetime.now(timezone.utc)
    row = await session.execute(
        text(
            """
WITH cte AS (
    SELECT id FROM scheduled_jobs
    WHERE status = 'pending' AND run_at <= :now
    ORDER BY run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE scheduled_jobs AS j
SET status = 'processing', updated_at = NOW()
FROM cte
WHERE j.id = cte.id
RETURNING j.id
"""
        ),
        {"now": now},
    )
    rid = row.scalar_one_or_none()
    return rid if rid is None else uuid.UUID(str(rid))


async def _run_send_gmail(session: AsyncSession, job: ScheduledJob) -> None:
    user = await session.get(User, job.user_id)
    if user is None:
        raise RuntimeError("user missing")
    creds = _credentials_from_user(user)
    if creds is None:
        raise RuntimeError(
            "No stored Google refresh token for this user. "
            "Sign out and sign in again with Google (include offline access / refresh token)."
        )
    if not creds.valid:
        creds.refresh(GoogleAuthRequest())
    p = job.payload_json
    gmail_service.send_email(
        creds,
        str(p["to"]),
        str(p["subject"]),
        str(p["body"]),
        p.get("thread_id"),
    )


async def process_one_job(session: AsyncSession, job_id: uuid.UUID) -> None:
    job = await session.get(ScheduledJob, job_id)
    if job is None or job.status != "processing":
        return
    try:
        if job.job_type == JOB_SEND_GMAIL:
            await _run_send_gmail(session, job)
        else:
            raise RuntimeError(f"unknown job_type: {job.job_type}")
        job.status = "completed"
        job.last_error = None
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        job.status = "failed"
        job.last_error = str(exc)[:8000]
    job.updated_at = datetime.now(timezone.utc)


async def run_due_jobs_once(session: AsyncSession) -> bool:
    async with session.begin():
        job_id = await _claim_next_job_id(session)
    if job_id is None:
        return False
    async with session.begin():
        await process_one_job(session, job_id)
    return True
