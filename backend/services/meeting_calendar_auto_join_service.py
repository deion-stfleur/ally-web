"""Calendar auto-join for meeting notes — only after explicit user opt-in via text."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import MeetingBotJob, User
from services.calendar_service import list_events_with_meeting_links
from services.google_auth import GOOGLE_TOKEN_URL
from services.google_token_crypto import decrypt_refresh_token
from services.meeting_baas_service import (
    extract_meeting_urls,
    join_meeting_for_user,
    meeting_baas_configured,
)

logger = logging.getLogger(__name__)

# Join bot ~2 minutes before start through 5 minutes after start.
JOIN_LEAD = timedelta(minutes=2)
JOIN_LATE = timedelta(minutes=5)
LOOKAHEAD = timedelta(minutes=25)

_ENABLE_RE = re.compile(
    r"\b("
    r"auto[\s-]?join\s+(my\s+)?(calendar\s+)?meetings"
    r"|join\s+my\s+(calendar\s+)?meetings\s+automatically"
    r"|automatically\s+join\s+(my\s+)?meetings"
    r"|auto[\s-]?join\s+(my\s+)?calendar"
    r"|join\s+meetings\s+from\s+my\s+calendar"
    r"|ally\s+join\s+my\s+calendar\s+meetings"
    r")\b",
    re.IGNORECASE,
)

_DISABLE_RE = re.compile(
    r"\b("
    r"stop\s+auto[\s-]?join(ing)?\s+(my\s+)?meetings"
    r"|don'?t\s+auto[\s-]?join"
    r"|turn\s+off\s+(calendar\s+)?auto[\s-]?join"
    r"|disable\s+(calendar\s+)?auto[\s-]?join"
    r"|cancel\s+auto[\s-]?join(ing)?\s+meetings"
    r")\b",
    re.IGNORECASE,
)


def _credentials_from_user(user: User) -> Credentials | None:
    rt = decrypt_refresh_token(user.google_refresh_token_encrypted)
    if not rt:
        return None
    scopes = user.google_scopes.split() if (user.google_scopes or "").strip() else None
    return Credentials(
        token=None,
        refresh_token=rt,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
    )


def parse_calendar_auto_join_intent(message: str) -> str | None:
    """Return 'enable', 'disable', or None."""
    text = (message or "").strip()
    if not text:
        return None
    if _DISABLE_RE.search(text):
        return "disable"
    if _ENABLE_RE.search(text):
        return "enable"
    return None


async def set_calendar_auto_join(
    db: AsyncSession, *, user: User, enabled: bool
) -> User:
    user.meeting_calendar_auto_join = enabled
    user.meeting_auto_join_opt_in_at = (
        datetime.now(timezone.utc) if enabled else None
    )
    await db.flush()
    return user


async def try_handle_calendar_auto_join_preference_sms(
    db: AsyncSession, *, user: User, message: str
) -> str | None:
    intent = parse_calendar_auto_join_intent(message)
    if intent is None:
        return None
    if intent == "disable":
        await set_calendar_auto_join(db, user=user, enabled=False)
        return (
            "got it — i won't auto-join calendar meetings anymore. "
            "text me a meet link when you want notes on a specific call."
        )
    if not (user.google_refresh_token_encrypted or "").strip():
        return (
            "to auto-join calendar meetings, connect google in the ally app first "
            "(calendar access). then text me again to turn it on."
        )
    if not meeting_baas_configured():
        return "meeting notes aren't available on the server right now — try again later."
    await set_calendar_auto_join(db, user=user, enabled=True)
    return (
        "saved — i'll auto-join google calendar meetings with a video link when they're "
        "about to start and text you notes when they end. admit ally notes from the waiting room. "
        "say stop auto-join meetings anytime to turn this off."
    )


def _parse_event_start(start_raw: str | None) -> datetime | None:
    if not start_raw:
        return None
    s = start_raw.strip()
    try:
        if len(s) == 10 and s[4] == "-":
            return None
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


async def _already_joined_event(
    db: AsyncSession, *, user_id: uuid.UUID, calendar_event_id: str
) -> bool:
    since = datetime.now(timezone.utc) - timedelta(hours=12)
    r = await db.execute(
        select(MeetingBotJob.id).where(
            MeetingBotJob.user_id == user_id,
            MeetingBotJob.calendar_event_id == calendar_event_id,
            MeetingBotJob.created_at >= since,
        )
    )
    return r.scalar_one_or_none() is not None


async def tick_calendar_auto_join(session: AsyncSession) -> int:
    """
    For users who opted in via text, join upcoming calendar events with video links.
    Call inside `async with session.begin():`.
    """
    if not meeting_baas_configured():
        return 0

    now = datetime.now(timezone.utc)
    r = await session.execute(
        select(User).where(User.meeting_calendar_auto_join.is_(True))
    )
    users = list(r.scalars().all())
    joined = 0

    for user in users:
        creds = _credentials_from_user(user)
        if creds is None:
            continue
        if not creds.valid:
            try:
                creds.refresh(GoogleAuthRequest())
            except RefreshError:
                logger.warning("calendar auto-join: google refresh failed user=%s", user.id)
                continue

        try:
            events = list_events_with_meeting_links(
                creds,
                time_min=now.isoformat().replace("+00:00", "Z"),
                time_max=(now + LOOKAHEAD).isoformat().replace("+00:00", "Z"),
                max_results=15,
            )
        except Exception:
            logger.exception("calendar auto-join: list events failed user=%s", user.id)
            continue

        for ev in events:
            eid = str(ev.get("id") or "").strip()
            url = str(ev.get("meeting_url") or "").strip()
            if not eid or not url:
                continue
            if not extract_meeting_urls(url):
                continue
            start = _parse_event_start(ev.get("start"))
            if start is None:
                continue
            window_start = start - JOIN_LEAD
            window_end = start + JOIN_LATE
            if not (window_start <= now <= window_end):
                continue
            if await _already_joined_event(session, user_id=user.id, calendar_event_id=eid):
                continue
            try:
                await join_meeting_for_user(
                    session,
                    user=user,
                    meeting_url=url,
                    calendar_event_id=eid,
                    join_source="calendar_auto",
                )
                joined += 1
                logger.info(
                    "calendar auto-join: bot dispatched user=%s event=%s",
                    user.id,
                    eid,
                )
            except Exception:
                logger.exception(
                    "calendar auto-join: join failed user=%s event=%s", user.id, eid
                )

    return joined
