from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ScheduledJob

JOB_SEND_GMAIL = "send_gmail"
JOB_AGENT_TASK_SMS = "agent_task_sms"
MAX_LEAD = timedelta(days=90)
_MAX_INSTRUCTION = 12_000


async def create_send_gmail_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    run_at: datetime,
    to: str,
    subject: str,
    body: str,
    thread_id: str | None,
) -> ScheduledJob:
    if run_at.tzinfo is None:
        raise ValueError("run_at must be timezone-aware (UTC recommended).")
    now = datetime.now(timezone.utc)
    if run_at <= now + timedelta(seconds=10):
        raise ValueError("run_at must be at least ~10 seconds in the future.")
    if run_at > now + MAX_LEAD:
        raise ValueError(f"run_at cannot be more than {MAX_LEAD.days} days ahead.")

    job = ScheduledJob(
        user_id=user_id,
        job_type=JOB_SEND_GMAIL,
        payload_json={
            "to": to.strip(),
            "subject": subject.strip(),
            "body": body,
            "thread_id": (thread_id.strip() if thread_id else None) or None,
        },
        run_at=run_at,
        status="pending",
    )
    db.add(job)
    await db.flush()
    return job


async def create_agent_task_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    run_at: datetime,
    instruction: str,
    conversation_id: uuid.UUID | None,
) -> ScheduledJob:
    """Queue a background `run_chat` turn; worker texts the user when done (if phone on file)."""
    text = (instruction or "").strip()
    if not text:
        raise ValueError("instruction is required.")
    if len(text) > _MAX_INSTRUCTION:
        raise ValueError(f"instruction too long (max {_MAX_INSTRUCTION} characters).")
    if run_at.tzinfo is None:
        raise ValueError("run_at must be timezone-aware (UTC recommended).")
    now = datetime.now(timezone.utc)
    if run_at <= now + timedelta(seconds=10):
        raise ValueError("run_at must be at least ~10 seconds in the future.")
    if run_at > now + MAX_LEAD:
        raise ValueError(f"run_at cannot be more than {MAX_LEAD.days} days ahead.")

    job = ScheduledJob(
        user_id=user_id,
        job_type=JOB_AGENT_TASK_SMS,
        payload_json={
            "instruction": text,
            "conversation_id": str(conversation_id) if conversation_id else None,
        },
        run_at=run_at,
        status="pending",
    )
    db.add(job)
    await db.flush()
    return job


async def list_jobs_for_user(
    db: AsyncSession, *, user_id: uuid.UUID, limit: int = 50
) -> list[ScheduledJob]:
    result = await db.execute(
        select(ScheduledJob)
        .where(ScheduledJob.user_id == user_id)
        .order_by(ScheduledJob.run_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def cancel_job_if_owned(
    db: AsyncSession, *, user_id: uuid.UUID, job_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(ScheduledJob).where(
            ScheduledJob.id == job_id,
            ScheduledJob.user_id == user_id,
            ScheduledJob.status == "pending",
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    row.status = "cancelled"
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return True
