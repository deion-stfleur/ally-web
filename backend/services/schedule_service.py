from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ScheduledJob

JOB_SEND_GMAIL = "send_gmail"
MAX_LEAD = timedelta(days=90)


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
