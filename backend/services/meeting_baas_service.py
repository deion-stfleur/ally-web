"""Meeting BaaS v2: join meetings, webhooks, summarize, SMS."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

import httpx
from anthropic import AsyncAnthropic
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import MeetingBotJob, User

logger = logging.getLogger(__name__)

MEETING_BAAS_API_V2 = "https://api.meetingbaas.com/v2/bots"

_MEETING_URL_RE = re.compile(
    r"https?://(?:"
    r"meet\.google\.com/[^\s\])>\"']+"
    r"|(?:[\w-]+\.)?zoom\.us/[^\s\])>\"']+"
    r"|teams\.microsoft\.com/[^\s\])>\"']+"
    r"|teams\.live\.com/[^\s\])>\"']+"
    r")",
    re.IGNORECASE,
)

_JOIN_INTENT_RE = re.compile(
    r"\b("
    r"join|notes|note.?taker|record|transcript|take notes|meeting notes|"
    r"ally join|join meeting|join this|hop on|sit in"
    r")\b",
    re.IGNORECASE,
)


class MeetingBaasNotConfiguredError(RuntimeError):
    pass


def meeting_baas_configured() -> bool:
    return bool((settings.meeting_baas_api_key or "").strip())


def _api_key() -> str:
    key = (settings.meeting_baas_api_key or "").strip()
    if not key:
        raise MeetingBaasNotConfiguredError("MEETING_BAAS_API_KEY is not set")
    return key


def backend_public_url() -> str:
    base = (settings.backend_public_url or "").strip().rstrip("/")
    if base:
        return base
    return "https://ally-web-backend-9e9dc3fed95b.herokuapp.com"


def meeting_webhook_url() -> str:
    return f"{backend_public_url()}/api/webhooks/meeting-baas"


def extract_meeting_urls(text: str) -> list[str]:
    return [m.group(0).rstrip(".,);]") for m in _MEETING_URL_RE.finditer(text or "")]


def wants_meeting_bot(text: str) -> bool:
    if not extract_meeting_urls(text):
        return False
    if _JOIN_INTENT_RE.search(text or ""):
        return True
    t = (text or "").lower()
    return "http" in t and ("meet.google" in t or "zoom.us" in t or "teams.microsoft" in t)


def verify_webhook_request(request: Request) -> None:
    expected = _api_key()
    got = (
        request.headers.get("x-meeting-baas-api-key")
        or request.headers.get("X-Meeting-Baas-Api-Key")
        or ""
    ).strip()
    if got != expected:
        raise PermissionError("invalid meeting baas webhook api key")


def normalize_event_name(payload: dict[str, Any]) -> str:
    for key in ("event", "type"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lower().replace(".", "_")
    data = payload.get("data")
    if isinstance(data, dict):
        inner = data.get("event")
        if isinstance(inner, str):
            return inner.strip().lower()
    return ""


def transcript_to_plaintext(data: dict[str, Any]) -> str:
    """Parse v1-style embedded transcript (fallback)."""
    transcript = data.get("transcript")
    if not isinstance(transcript, list):
        return ""
    lines: list[str] = []
    for block in transcript:
        if not isinstance(block, dict):
            continue
        speaker = str(block.get("speaker") or "Speaker").strip()
        words = block.get("words")
        if isinstance(words, list) and words:
            text = " ".join(
                str(w.get("word") or "").strip()
                for w in words
                if isinstance(w, dict) and w.get("word")
            ).strip()
        else:
            text = str(block.get("text") or "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


def _v2_transcript_to_plaintext(utterances: list[dict[str, Any]]) -> str:
    """Parse v2 output_transcription.json utterances format."""
    lines: list[str] = []
    for u in utterances:
        if not isinstance(u, dict):
            continue
        speaker = str(u.get("speaker") or u.get("channel") or "Speaker").strip()
        text = str(u.get("text") or "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


async def _fetch_v2_transcript(transcription_url: str) -> str:
    """Download transcription JSON from presigned S3 URL and convert to plaintext."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(transcription_url)
            if resp.status_code != 200:
                logger.warning("failed to fetch v2 transcript url=%s status=%d", transcription_url, resp.status_code)
                return ""
            payload = resp.json()
    except Exception:
        logger.exception("error fetching v2 transcript from %s", transcription_url)
        return ""

    # output_transcription.json has a "result" key with "utterances"
    if isinstance(payload, dict):
        result = payload.get("result") or payload
        utterances = result.get("utterances") if isinstance(result, dict) else None
        if isinstance(utterances, list):
            return _v2_transcript_to_plaintext(utterances)
        # Fallback: maybe it's directly a list of utterances
        if isinstance(payload.get("utterances"), list):
            return _v2_transcript_to_plaintext(payload["utterances"])
    if isinstance(payload, list):
        return _v2_transcript_to_plaintext(payload)
    return ""


async def join_meeting_for_user(
    db: AsyncSession,
    *,
    user: User,
    meeting_url: str,
    calendar_event_id: str | None = None,
    join_source: str | None = None,
) -> MeetingBotJob:
    url = meeting_url.strip()
    if not url:
        raise ValueError("meeting_url is required")

    body: dict[str, Any] = {
        "bot_name": "Ally Notes",
        "meeting_url": url,
        "webhook_url": meeting_webhook_url(),
        "entry_message": "Ally is taking notes for the host.",
        "extra": {"ally_user_id": str(user.id)},
        "recording_mode": "speaker_view",
        "transcription_enabled": True,
        "transcription_config": {"provider": "gladia"},
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            MEETING_BAAS_API_V2,
            headers={
                "x-meeting-baas-api-key": _api_key(),
                "Content-Type": "application/json",
            },
            json=body,
        )
        if resp.status_code >= 400:
            detail = resp.text[:500]
            raise RuntimeError(f"Meeting BaaS join failed ({resp.status_code}): {detail}")
        envelope = resp.json()

    # v2 wraps response in {success, data}
    resp_data = envelope.get("data") if isinstance(envelope.get("data"), dict) else envelope
    bot_id = str(resp_data.get("bot_id") or "").strip()
    if not bot_id:
        raise RuntimeError("Meeting BaaS did not return bot_id")

    job = MeetingBotJob(
        user_id=user.id,
        external_bot_id=bot_id,
        meeting_url=url,
        calendar_event_id=(calendar_event_id or "").strip() or None,
        join_source=(join_source or "").strip() or None,
        status="joined",
    )
    db.add(job)
    await db.flush()
    return job


async def summarize_transcript(transcript_plain: str) -> str:
    text = (transcript_plain or "").strip()
    if not text:
        return "meeting ended but i didn't catch much audio — try again with the bot admitted to the call."
    if len(text) > 120_000:
        text = text[:120_000] + "\n…(truncated)"

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=(
            "you summarize meeting transcripts for sms. lowercase, no markdown lists, "
            "short paragraphs. include: what was decided, action items, and open questions. "
            "max ~6 sentences unless the meeting was long."
        ),
        messages=[
            {
                "role": "user",
                "content": f"Summarize this meeting transcript:\n\n{text}",
            }
        ],
    )
    parts = [b.text for b in resp.content if hasattr(b, "text") and b.type == "text"]
    return ("".join(parts)).strip() or "meeting ended — no summary generated."


async def get_job_by_bot_id(
    db: AsyncSession, external_bot_id: str
) -> MeetingBotJob | None:
    r = await db.execute(
        select(MeetingBotJob).where(MeetingBotJob.external_bot_id == external_bot_id)
    )
    return r.scalar_one_or_none()


async def resolve_user_for_job(
    db: AsyncSession, job: MeetingBotJob, data: dict[str, Any]
) -> User | None:
    user = await db.get(User, job.user_id)
    if user is not None:
        return user
    extra = data.get("extra")
    if isinstance(extra, dict):
        raw = extra.get("ally_user_id")
        if raw:
            try:
                return await db.get(User, uuid.UUID(str(raw)))
            except (ValueError, TypeError):
                pass
    return None


async def process_meeting_webhook_payload(
    db: AsyncSession,
    payload: dict[str, Any],
) -> None:
    event = normalize_event_name(payload)
    # v2 nests data under "data" key
    data = payload.get("data")
    if not isinstance(data, dict):
        data = payload

    bot_id = str(data.get("bot_id") or payload.get("bot_id") or "").strip()
    if not bot_id:
        logger.warning("meeting baas webhook missing bot_id: %s", event)
        return

    job = await get_job_by_bot_id(db, bot_id)
    if job is None:
        logger.warning("meeting baas unknown bot_id=%s event=%s", bot_id, event)
        return

    if job.status in ("completed", "failed") and event in (
        "complete",
        "completed",
        "bot_completed",
        "failed",
        "bot_failed",
    ):
        return

    job.webhook_payload = payload

    if event in ("failed", "bot_failed"):
        job.status = "failed"
        job.error_message = str(
            data.get("message") or data.get("error_message") or data.get("error") or "bot failed"
        )[:2000]
        await db.flush()
        user = await resolve_user_for_job(db, job, data)
        if user and (user.phone_e164 or "").strip():
            from services.sendblue_webhook_service import send_sendblue_text_async

            msg = f"ally — couldn't join/record the meeting: {job.error_message[:200]}"
            await send_sendblue_text_async(to_number=user.phone_e164, content=msg)
        return

    if event not in ("complete", "completed", "bot_completed"):
        logger.info("meeting baas webhook ignored event=%s bot=%s", event, bot_id)
        return

    # v2: fetch transcript from presigned URL; fall back to embedded v1 format
    plain = ""
    transcription_url = data.get("transcription") or data.get("raw_transcription")
    if transcription_url and isinstance(transcription_url, str) and transcription_url.startswith("http"):
        plain = await _fetch_v2_transcript(transcription_url)

    if not plain:
        plain = transcript_to_plaintext(data)

    summary = await summarize_transcript(plain)
    job.status = "completed"
    job.summary_text = summary
    await db.flush()

    user = await resolve_user_for_job(db, job, data)
    if user and (user.phone_e164 or "").strip():
        from services.sendblue_webhook_service import send_sendblue_text_async

        sms = f"ally — meeting notes:\n{summary}"
        from services.sendblue_webhook_service import _sms_plain

        await send_sendblue_text_async(
            to_number=user.phone_e164,
            content=_sms_plain(sms, max_len=1500),
        )


async def try_handle_meeting_join_sms(
    db: AsyncSession,
    *,
    user: User,
    message: str,
) -> str | None:
    """If message requests a meeting bot, join and return reply text (or None)."""
    if not meeting_baas_configured():
        return None
    urls = extract_meeting_urls(message)
    if not urls or not wants_meeting_bot(message):
        return None
    try:
        await join_meeting_for_user(db, user=user, meeting_url=urls[0])
        return (
            "joining your meeting as ally notes — i'll text you a summary when the call ends."
        )
    except Exception as e:
        logger.exception("meeting bot join failed user=%s", user.id)
        return f"couldn't join that meeting: {str(e)[:180]}"

