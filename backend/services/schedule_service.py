from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ScheduledJob

JOB_SEND_GMAIL = "send_gmail"
JOB_AGENT_TASK_SMS = "agent_task_sms"
JOB_BROWSER_TASK = "browser_task"
JOB_EXTRACT_USER_PROFILE = "extract_user_profile"
MAX_LEAD = timedelta(days=90)
_MAX_INSTRUCTION = 12_000
from services.billing_plans import TASK_RUNNER_DAILY_AUTOMATIONS

TASK_RUNNER_DAILY_LIMIT_MSG = (
    f"task runner plan allows {TASK_RUNNER_DAILY_AUTOMATIONS} background automations per day — upgrade at "
    f"{settings.frontend_url.rstrip('/')}/pricing for unlimited tasks."
)


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


async def count_agent_tasks_today(
    db: AsyncSession, *, user_id: uuid.UUID
) -> int:
    """Background automations queued today (UTC), excluding internal jobs."""
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    result = await db.execute(
        select(func.count())
        .select_from(ScheduledJob)
        .where(
            ScheduledJob.user_id == user_id,
            ScheduledJob.job_type == JOB_AGENT_TASK_SMS,
            ScheduledJob.created_at >= start,
            ScheduledJob.created_at < end,
        )
    )
    return int(result.scalar_one() or 0)


async def create_agent_task_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    run_at: datetime,
    instruction: str,
    conversation_id: uuid.UUID | None,
    watch_rule_id: uuid.UUID | None = None,
) -> ScheduledJob:
    """Queue a background `run_chat` turn; worker texts the user when done (if phone on file)."""
    from db.models import User
    from services.billing_plans import (
        TASK_RUNNER_DAILY_AUTOMATIONS,
        user_on_task_runner,
    )

    user = await db.get(User, user_id)
    if user is None:
        raise ValueError("user not found.")
    if user_on_task_runner(user):
        used = await count_agent_tasks_today(db, user_id=user_id)
        if used >= TASK_RUNNER_DAILY_AUTOMATIONS:
            raise ValueError("daily_limit_reached")

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

    payload: dict = {
        "instruction": text,
        "conversation_id": str(conversation_id) if conversation_id else None,
    }
    if watch_rule_id is not None:
        payload["watch_rule_id"] = str(watch_rule_id)
    job = ScheduledJob(
        user_id=user_id,
        job_type=JOB_AGENT_TASK_SMS,
        payload_json=payload,
        run_at=run_at,
        status="pending",
    )
    db.add(job)
    await db.flush()
    return job


async def create_browser_task_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    run_at: datetime,
    task: str,
    conversation_id: uuid.UUID | None,
    start_url: str | None = None,
) -> ScheduledJob:
    """Queue a Browser Use job (Railway worker). Ally Pro only."""
    from db.models import User
    from services.billing_plans import user_has_ally_pro

    user = await db.get(User, user_id)
    if user is None:
        raise ValueError("user not found.")
    if not user_has_ally_pro(user):
        raise ValueError("pro_required")

    text = (task or "").strip()
    if not text:
        raise ValueError("task is required.")
    if len(text) > _MAX_INSTRUCTION:
        raise ValueError(f"task too long (max {_MAX_INSTRUCTION} characters).")
    if run_at.tzinfo is None:
        raise ValueError("run_at must be timezone-aware (UTC recommended).")
    now = datetime.now(timezone.utc)
    if run_at > now + MAX_LEAD:
        raise ValueError(f"run_at cannot be more than {MAX_LEAD.days} days ahead.")

    payload: dict = {
        "task": text,
        "conversation_id": str(conversation_id) if conversation_id else None,
    }
    if start_url and (start_url := start_url.strip()):
        payload["start_url"] = start_url

    job = ScheduledJob(
        user_id=user_id,
        job_type=JOB_BROWSER_TASK,
        payload_json=payload,
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
