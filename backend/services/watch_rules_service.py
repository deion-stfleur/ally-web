from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import UserWatchRule
from services.schedule_service import create_agent_task_job

WATCH_MODE_DAILY = "daily"
WATCH_MODE_INSTANT = "instant"
DEFAULT_INSTANT_POLL_MINUTES = 15
MIN_INSTANT_POLL_MINUTES = 5
MAX_INSTANT_POLL_MINUTES = 60

ALL_QUIET_PREFIX = "ALL_QUIET"


def normalize_time_local(raw: str | None) -> str:
    s = (raw or "").strip()
    if not s:
        return "09:00"
    s = s.replace(".", ":")
    parts = s.split(":")
    try:
        h = max(0, min(23, int(parts[0])))
        m = max(0, min(59, int(parts[1]) if len(parts) > 1 else 0))
    except (ValueError, IndexError):
        return "09:00"
    return f"{h:02d}:{m:02d}"


def resolve_timezone(raw: str | None) -> str:
    name = (raw or "").strip() or "America/New_York"
    try:
        ZoneInfo(name)
        return name
    except Exception:
        return "America/New_York"


def normalize_watch_mode(raw: str | None) -> str:
    mode = (raw or "").strip().lower()
    if mode in ("instant", "push", "realtime", "real-time"):
        return WATCH_MODE_INSTANT
    return WATCH_MODE_DAILY


def normalize_poll_interval(raw: int | None) -> int:
    try:
        n = int(raw if raw is not None else DEFAULT_INSTANT_POLL_MINUTES)
    except (TypeError, ValueError):
        n = DEFAULT_INSTANT_POLL_MINUTES
    return max(MIN_INSTANT_POLL_MINUTES, min(MAX_INSTANT_POLL_MINUTES, n))


def compute_next_run_utc(*, time_local: str, tz_name: str, after_utc: datetime) -> datetime:
    """First clock time `time_local` in `tz_name` that is strictly after `after_utc`."""
    if after_utc.tzinfo is None:
        after_utc = after_utc.replace(tzinfo=timezone.utc)
    tz = ZoneInfo(resolve_timezone(tz_name))
    tl = normalize_time_local(time_local)
    hh, mm = int(tl[:2]), int(tl[3:5])
    local_anchor = after_utc.astimezone(tz)
    candidate = local_anchor.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if candidate <= local_anchor:
        candidate = candidate + timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def compute_next_instant_run(
    *, after_utc: datetime, poll_interval_minutes: int
) -> datetime:
    if after_utc.tzinfo is None:
        after_utc = after_utc.replace(tzinfo=timezone.utc)
    return after_utc + timedelta(minutes=normalize_poll_interval(poll_interval_minutes))


def build_watch_instruction(rule: UserWatchRule) -> str:
    spec = rule.spec_text[:6000]
    if normalize_watch_mode(rule.watch_mode) == WATCH_MODE_INSTANT:
        prev = (rule.last_digest or "").strip() or "(none — first check)"
        return (
            "INSTANT PUSH WATCH — text the user only when something meaningful changed.\n"
            f"WATCH SPEC:\n{spec}\n\n"
            f"PREVIOUS STATE (compare to now):\n{prev}\n\n"
            "Use web_search and Google tools if connected. "
            "If nothing meaningful changed, reply with first line exactly: ALL_QUIET "
            "then one short line (under 120 chars). "
            "If something changed, reply with one SMS update under 450 characters — "
            "do NOT use ALL_QUIET."
        )
    return (
        "Scheduled daily watch for a user who asked to be texted about this topic.\n"
        f"WATCH SPEC:\n{spec}\n\n"
        "Use web_search and Google tools if the user connected Google. "
        "Reply in one SMS-sized update (under 450 characters). "
        "If there is no meaningful change, start with ALL_QUIET then one short line."
    )


async def create_watch_rule(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    spec_text: str,
    time_local: str | None = None,
    tz_name: str | None = None,
    watch_mode: str | None = None,
    poll_interval_minutes: int | None = None,
) -> UserWatchRule:
    spec = (spec_text or "").strip()
    if not spec:
        raise ValueError("spec_text is required.")
    if len(spec) > 8000:
        raise ValueError("spec_text too long (max 8000 characters).")
    tl = normalize_time_local(time_local)
    tz = resolve_timezone(tz_name)
    mode = normalize_watch_mode(watch_mode)
    poll = normalize_poll_interval(poll_interval_minutes)
    now = datetime.now(timezone.utc)
    if mode == WATCH_MODE_INSTANT:
        nxt = compute_next_instant_run(after_utc=now, poll_interval_minutes=2)
    else:
        nxt = compute_next_run_utc(time_local=tl, tz_name=tz, after_utc=now)
    row = UserWatchRule(
        user_id=user_id,
        spec_text=spec,
        time_local=tl,
        timezone=tz,
        watch_mode=mode,
        poll_interval_minutes=poll,
        status="active",
        next_run_at=nxt,
    )
    db.add(row)
    await db.flush()
    return row


async def list_watch_rules(
    db: AsyncSession, *, user_id: uuid.UUID, limit: int = 50
) -> list[UserWatchRule]:
    lim = max(1, min(int(limit), 100))
    r = await db.execute(
        select(UserWatchRule)
        .where(UserWatchRule.user_id == user_id)
        .order_by(UserWatchRule.created_at.desc())
        .limit(lim)
    )
    return list(r.scalars().all())


async def set_watch_rule_status(
    db: AsyncSession, *, user_id: uuid.UUID, rule_id: uuid.UUID, status: str
) -> UserWatchRule | None:
    st = (status or "").strip().lower()
    if st not in ("active", "paused"):
        raise ValueError("status must be active or paused.")
    r = await db.execute(
        select(UserWatchRule).where(
            UserWatchRule.id == rule_id,
            UserWatchRule.user_id == user_id,
        )
    )
    row = r.scalar_one_or_none()
    if row is None:
        return None
    row.status = st
    await db.flush()
    return row


async def delete_watch_rule(
    db: AsyncSession, *, user_id: uuid.UUID, rule_id: uuid.UUID
) -> bool:
    res = await db.execute(
        delete(UserWatchRule).where(
            UserWatchRule.id == rule_id,
            UserWatchRule.user_id == user_id,
        )
    )
    await db.flush()
    return (res.rowcount or 0) > 0


async def apply_watch_job_result(
    db: AsyncSession,
    *,
    rule_id: uuid.UUID,
    reply_body: str,
) -> None:
    """Update digest after a watch poll; used by the worker."""
    r = await db.execute(select(UserWatchRule).where(UserWatchRule.id == rule_id))
    rule = r.scalar_one_or_none()
    if rule is None:
        return
    body = (reply_body or "").strip()
    if body.upper().startswith(ALL_QUIET_PREFIX):
        return
    rule.last_digest = body[:8000] if body else rule.last_digest


async def enqueue_due_watch_rules(session: AsyncSession) -> int:
    """
    Claim due active rules, advance next_run_at, enqueue agent_task_sms for each.
    Call inside `async with session.begin():`.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(UserWatchRule)
        .where(
            UserWatchRule.status == "active",
            UserWatchRule.next_run_at <= now,
        )
        .order_by(UserWatchRule.next_run_at.asc())
        .limit(5)
        .with_for_update(skip_locked=True)
    )
    result = await session.execute(stmt)
    rules = list(result.scalars().all())
    count = 0
    for rule in rules:
        mode = normalize_watch_mode(rule.watch_mode)
        if mode == WATCH_MODE_INSTANT:
            rule.next_run_at = compute_next_instant_run(
                after_utc=now + timedelta(seconds=1),
                poll_interval_minutes=rule.poll_interval_minutes,
            )
        else:
            rule.next_run_at = compute_next_run_utc(
                time_local=rule.time_local,
                tz_name=rule.timezone,
                after_utc=now + timedelta(seconds=1),
            )
        instr = build_watch_instruction(rule)
        await create_agent_task_job(
            session,
            user_id=rule.user_id,
            run_at=now + timedelta(seconds=15),
            instruction=instr,
            conversation_id=None,
            watch_rule_id=rule.id,
        )
        count += 1
    return count
