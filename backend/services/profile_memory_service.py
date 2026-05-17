from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import User
from services.chat_persist import get_owned_conversation, load_conversation_messages
from services.user_profile_service import (
    get_or_create_profile,
    merge_profile_from_extraction,
)

logger = logging.getLogger(__name__)

_EXTRACT_SYSTEM = """You extract user interests and messaging habits from SMS conversations.
Return ONLY valid JSON with this shape (no markdown):
{
  "interests": ["celtics", "succession", "ai news"],
  "active_hours": ["evening", "8pm-11pm"],
  "preferred_update_time": null,
  "timezone": "America/New_York"
}

Rules:
- interests: sports teams, shows/movies, music, news topics, locations, hobbies they'd want updates on.
- active_hours: short labels inferred from message timestamps and reply speed (e.g. "morning", "9pm-11pm").
- preferred_update_time: only if they explicitly said when they want texts (morning/evening/whenever/never/HH:MM); else null.
- timezone: IANA name if inferable from context, else America/New_York.
- Merge with existing profile; add new interests, don't duplicate.
- If nothing new, return {"interests":[],"active_hours":[],"preferred_update_time":null,"timezone":null}."""


def _strip_json_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _format_transcript(messages: list) -> str:
    lines: list[str] = []
    for m in messages:
        role = getattr(m, "role", "user")
        content = (getattr(m, "content", "") or "").strip()
        if not content:
            continue
        ts = getattr(m, "created_at", None)
        ts_s = ts.isoformat() if ts else ""
        lines.append(f"[{ts_s}] {role}: {content[:2000]}")
    return "\n".join(lines[-60:])


async def extract_profile_from_conversation(
    db: AsyncSession,
    *,
    user: User,
    conversation_id: uuid.UUID,
) -> bool:
    profile = await get_or_create_profile(db, user=user)
    conv = await get_owned_conversation(
        db, user_id=user.id, conversation_id=conversation_id
    )
    if conv is None:
        return False

    _c, msgs = await load_conversation_messages(
        db, user_id=user.id, conversation_id=conversation_id, message_limit=80
    )
    if not msgs:
        return False

    if profile.last_memory_extract_at is not None:
        msgs = [m for m in msgs if m.created_at > profile.last_memory_extract_at]
    if len(msgs) < 2:
        profile.last_memory_extract_at = datetime.now(timezone.utc)
        return False

    transcript = _format_transcript(msgs)
    existing = {
        "interests": profile.interests or [],
        "active_hours": profile.active_hours or [],
        "preferred_update_time": profile.preferred_update_time,
        "timezone": profile.timezone,
    }
    user_block = (
        f"Existing profile JSON:\n{json.dumps(existing)}\n\n"
        f"New conversation messages since last extract:\n{transcript}"
    )

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        resp = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            temperature=0.2,
            system=_EXTRACT_SYSTEM,
            messages=[{"role": "user", "content": user_block}],
        )
    except Exception:
        logger.exception("profile memory extract failed user_id=%s", user.id)
        return False

    parts = [b.text for b in resp.content if b.type == "text"]
    raw = _strip_json_fence("".join(parts))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            logger.warning("profile extract bad json user_id=%s", user.id)
            return False
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            logger.warning("profile extract bad json user_id=%s", user.id)
            return False

    if not isinstance(data, dict):
        return False

    merge_profile_from_extraction(profile, data)
    profile.last_memory_extract_at = datetime.now(timezone.utc)
    await db.flush()
    return True
