from __future__ import annotations

import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import User, UserProfile
from services.sendblue_webhook_service import send_sendblue_text_async
from services.user_profile_service import (
    can_send_proactive,
    is_in_proactive_window,
    record_proactive_sent,
)

logger = logging.getLogger(__name__)

_NATIVE_WEB_SEARCH = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 3,
}

_DECIDE_SYSTEM = """You decide whether to send a proactive SMS to a friend.
They care about the listed interests. You get web search snippets.

If nothing is timely and worth texting about, reply with exactly: SKIP
If yes, write a short casual text:
- lowercase, no markdown, max 2 sentences
- feels like a friend who remembered something they'd care about
- never start with "i"
- don't mention searching or notifications
- don't repeat topics from recent_topics_sent

Return ONLY the SMS text or SKIP."""


def _search_queries_for_interests(interests: list[str]) -> list[str]:
    queries: list[str] = []
    for item in interests[:6]:
        s = str(item).strip()
        if not s:
            continue
        low = s.lower()
        if any(x in low for x in ("nba", "nfl", "mlb", "nhl", "fc", "united", "celtics", "lakers")):
            queries.append(f"{s} game tonight score")
        elif any(x in low for x in ("show", "series", "season", "episode")):
            queries.append(f"{s} new episode today")
        else:
            queries.append(f"{s} news today")
        if len(queries) >= 3:
            break
    return queries[:3]


async def _run_web_searches(queries: list[str]) -> str:
    if not queries:
        return json.dumps({"results": []})
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        "Search the web for each topic below and summarize findings in one short paragraph "
        "per topic (facts only, for an internal digest). Topics:\n"
        + "\n".join(f"- {q}" for q in queries)
    )
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
    combined: list[str] = []
    for _ in range(4):
        resp = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            system="Use web_search. Be factual and concise.",
            messages=messages,
            tools=[_NATIVE_WEB_SEARCH],
        )
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": _serialize_content(resp.content)})
            continue
        for block in resp.content:
            if block.type == "text" and block.text.strip():
                combined.append(block.text.strip())
        break
    return "\n\n".join(combined) if combined else ""


def _serialize_content(content: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for b in content:
        if hasattr(b, "model_dump"):
            out.append(b.model_dump())
        elif b.type == "text":
            out.append({"type": "text", "text": b.text})
        elif b.type == "server_tool_use":
            out.append(
                {
                    "type": "server_tool_use",
                    "id": b.id,
                    "name": b.name,
                    "input": b.input,
                }
            )
        elif b.type == "web_search_tool_result":
            out.append(
                {
                    "type": "web_search_tool_result",
                    "tool_use_id": b.tool_use_id,
                    "content": b.content,
                }
            )
    return out


async def _decide_proactive_message(
    *,
    interests: list[str],
    search_digest: str,
    recent_topics: list[str],
) -> tuple[str | None, str | None]:
    """Returns (message, topic_key) or (None, None) for SKIP."""
    if not search_digest.strip():
        return None, None
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_block = (
        f"interests: {json.dumps(interests)}\n"
        f"recent_topics_sent: {json.dumps(recent_topics)}\n\n"
        f"search digest:\n{search_digest[:6000]}"
    )
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=256,
        temperature=0.4,
        system=_DECIDE_SYSTEM,
        messages=[{"role": "user", "content": user_block}],
    )
    parts = [b.text for b in resp.content if b.type == "text"]
    text = "".join(parts).strip()
    if not text or text.upper() == "SKIP" or text.lower().startswith("skip"):
        return None, None
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = text.strip().lower()
    if text.startswith("i "):
        text = text[2:].strip()
    topic = interests[0] if interests else text[:80]
    return text[:480], str(topic)[:120]


async def try_proactive_message_for_profile(
    db: AsyncSession,
    *,
    profile: UserProfile,
    user: User,
) -> bool:
    if not can_send_proactive(profile):
        return False
    if not is_in_proactive_window(profile):
        return False
    phone = (user.phone_e164 or profile.phone_e164 or "").strip()
    if not phone or user.phone_verified_at is None:
        return False

    interests = [str(x).strip() for x in (profile.interests or []) if str(x).strip()]
    if not interests:
        return False

    queries = _search_queries_for_interests(interests)
    try:
        digest = await _run_web_searches(queries)
    except Exception:
        logger.exception("proactive web search failed user_id=%s", user.id)
        return False

    msg, topic = await _decide_proactive_message(
        interests=interests,
        search_digest=digest,
        recent_topics=[str(x) for x in (profile.recent_topics_sent or [])],
    )
    if not msg:
        return False

    await send_sendblue_text_async(to_number=phone, content=msg)
    record_proactive_sent(profile, topic=topic or msg, message=msg)
    await db.flush()
    logger.info("proactive SMS sent user_id=%s topic=%s", user.id, topic)
    return True


async def run_proactive_tick(session: AsyncSession) -> int:
    """Evaluate all profiles; send at most one proactive text per eligible user."""
    result = await session.execute(
        select(UserProfile, User)
        .join(User, User.id == UserProfile.user_id)
        .where(User.phone_e164.is_not(None), User.phone_verified_at.is_not(None))
    )
    rows = list(result.all())
    sent = 0
    for profile, user in rows:
        try:
            if await try_proactive_message_for_profile(db=session, profile=profile, user=user):
                sent += 1
        except Exception:
            logger.exception("proactive tick failed user_id=%s", user.id)
    return sent
