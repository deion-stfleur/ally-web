from __future__ import annotations

import re
import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ScheduledJob, User, UserProfile
from services.schedule_service import JOB_EXTRACT_USER_PROFILE

ONBOARDING_QUESTION = (
    "oh also — when do you like getting updates? morning, evening, or just whenever?"
)

_PROACTIVE_COOLDOWN = timedelta(hours=3)
_MEMORY_IDLE_MINUTES = 10


def _norm_interests(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        s = str(item or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s[:200])
    return out[:40]


def _norm_active_hours(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        s = str(item or "").strip()
        if s:
            out.append(s[:80])
    return out[:20]


def _norm_topics(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(x).strip()[:120] for x in raw if str(x or "").strip()][:15]


async def get_or_create_profile(
    db: AsyncSession, *, user: User
) -> UserProfile:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        if user.phone_e164 and row.phone_e164 != user.phone_e164:
            row.phone_e164 = user.phone_e164
        return row
    row = UserProfile(
        user_id=user.id,
        phone_e164=user.phone_e164,
        interests=[],
        active_hours=[],
        recent_topics_sent=[],
    )
    db.add(row)
    await db.flush()
    return row


async def schedule_memory_extraction(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> None:
    """Re-schedule profile extraction for 10 minutes after the latest message."""
    run_at = datetime.now(timezone.utc) + timedelta(minutes=_MEMORY_IDLE_MINUTES)
    await db.execute(
        update(ScheduledJob)
        .where(
            ScheduledJob.user_id == user_id,
            ScheduledJob.job_type == JOB_EXTRACT_USER_PROFILE,
            ScheduledJob.status == "pending",
        )
        .values(status="cancelled", updated_at=datetime.now(timezone.utc))
    )
    db.add(
        ScheduledJob(
            user_id=user_id,
            job_type=JOB_EXTRACT_USER_PROFILE,
            payload_json={"conversation_id": str(conversation_id)},
            run_at=run_at,
            status="pending",
        )
    )
    await db.flush()


def parse_preferred_update_time(text: str) -> str | None:
    """Best-effort parse of when the user wants proactive texts."""
    t = (text or "").strip().lower()
    if not t:
        return None
    if any(x in t for x in ("don't text", "do not text", "no texts", "stop texting")):
        return "never"
    if "before noon" in t or "not before noon" in t or "after noon" in t:
        return "afternoon"
    if re.search(r"\b(morning|mornings|am)\b", t):
        return "morning"
    if re.search(r"\b(evening|evenings|night|nights|pm)\b", t):
        return "evening"
    if "whenever" in t or "anytime" in t or "any time" in t:
        return "whenever"
    if re.search(r"\bnoon\b", t):
        return "noon"
    m = re.search(r"(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?", t)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        ampm = (m.group(3) or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


async def maybe_capture_update_preference(
    db: AsyncSession, *, user: User, message: str
) -> bool:
    """Save preferred_update_time when the user states when they want proactive texts."""
    pref = parse_preferred_update_time(message)
    if pref is None:
        return False
    profile = await get_or_create_profile(db, user=user)
    profile.preferred_update_time = pref
    profile.last_updated = datetime.now(timezone.utc)
    await db.flush()
    return True


def _local_now(profile: UserProfile) -> datetime:
    tz_name = (profile.timezone or "America/New_York").strip() or "America/New_York"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("America/New_York")
    return datetime.now(timezone.utc).astimezone(tz)


def _hour_in_range(hour: int, start: int, end: int) -> bool:
    if start <= end:
        return start <= hour < end
    return hour >= start or hour < end


def _matches_active_hours(profile: UserProfile, local_dt: datetime) -> bool:
    hours = _norm_active_hours(profile.active_hours)
    if not hours:
        return False
    h = local_dt.hour
    for label in hours:
        low = label.lower()
        if "morning" in low and 6 <= h < 12:
            return True
        if "afternoon" in low and 12 <= h < 17:
            return True
        if "evening" in low and 17 <= h < 23:
            return True
        if "night" in low and (h >= 21 or h < 6):
            return True
        m = re.search(r"(\d{1,2})\s*(?:am|pm)?\s*[-–]\s*(\d{1,2})\s*(?:am|pm)?", low)
        if m:
            a = int(m.group(1)) % 24
            b = int(m.group(2)) % 24
            if _hour_in_range(h, a, b):
                return True
    return False


def _matches_preferred_time(profile: UserProfile, local_dt: datetime) -> bool:
    pref = (profile.preferred_update_time or "").strip().lower()
    if not pref or pref == "never":
        return False
    if pref == "whenever":
        return True
    h = local_dt.hour
    if pref == "morning":
        return 7 <= h < 11
    if pref == "noon":
        return 11 <= h < 13
    if pref == "afternoon":
        return 12 <= h < 17
    if pref == "evening":
        return 17 <= h < 21
    m = re.match(r"^(\d{1,2}):(\d{2})$", pref)
    if m:
        target_h = int(m.group(1))
        return h == target_h
    return False


def is_in_proactive_window(profile: UserProfile) -> bool:
    """True when now matches preferred_update_time or inferred active_hours."""
    pref = (profile.preferred_update_time or "").strip().lower()
    if pref == "never":
        return False
    local_dt = _local_now(profile)
    if pref:
        return _matches_preferred_time(profile, local_dt)
    return _matches_active_hours(profile, local_dt)


def can_send_proactive(profile: UserProfile) -> bool:
    if not profile.interests:
        return False
    if profile.last_proactive_sent is None:
        return True
    return datetime.now(timezone.utc) - profile.last_proactive_sent >= _PROACTIVE_COOLDOWN


def merge_profile_from_extraction(
    profile: UserProfile,
    data: dict[str, Any],
) -> None:
    interests = _norm_interests(data.get("interests"))
    if interests:
        merged = _norm_interests(profile.interests + interests)
        profile.interests = merged
    active = _norm_active_hours(data.get("active_hours"))
    if active:
        profile.active_hours = _norm_active_hours(profile.active_hours + active)
    pref = data.get("preferred_update_time")
    if isinstance(pref, str) and pref.strip():
        profile.preferred_update_time = pref.strip()[:128]
    tz = data.get("timezone")
    if isinstance(tz, str) and tz.strip():
        profile.timezone = tz.strip()[:64]
    profile.last_updated = datetime.now(timezone.utc)


def record_proactive_sent(profile: UserProfile, *, topic: str, message: str) -> None:
    now = datetime.now(timezone.utc)
    profile.last_proactive_sent = now
    profile.last_updated = now
    topics = _norm_topics(profile.recent_topics_sent)
    topic_key = (topic or message)[:120].strip().lower()
    if topic_key:
        topics = [t for t in topics if t.lower() != topic_key]
        topics.append(topic_key[:120])
    profile.recent_topics_sent = topics[-10:]
