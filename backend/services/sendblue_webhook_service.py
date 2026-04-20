from __future__ import annotations

import asyncio
import logging
import re
import uuid
from typing import Any

from google.auth.transport.requests import Request as GoogleAuthRequest
from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import SendblueInboundDedupe, User
from services.phone_e164 import normalize_e164
from services.chat_persist import (
    append_pair,
    create_conversation,
    get_owned_conversation,
    load_conversation_messages,
)
from services.claude_service import run_chat
from services.job_runner import _credentials_from_user

logger = logging.getLogger(__name__)


def _sendblue_message_type_normalized(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip().lower()
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return str(v).strip().lower()
    # Arrays/objects would stringify oddly; treat as unknown (not "group").
    logger.warning("sendblue unexpected message_type type=%s", type(v).__name__)
    return ""


def _sendblue_payload_str(payload: dict[str, Any], key: str) -> str:
    """Sendblue fields are strings in docs; coerce so we never crash on `.strip()`."""
    v = payload.get(key)
    if v is None:
        return ""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return str(v).strip()
    logger.warning("sendblue unexpected %s type=%s", key, type(v).__name__)
    return ""


def sendblue_integration_ready() -> bool:
    return len(sendblue_missing_env()) == 0


def sendblue_missing_env() -> list[str]:
    """Human-readable names for unset vars (no secret values)."""
    missing: list[str] = []
    if not settings.sendblue_api_key:
        missing.append("SENDBLUE_API_KEY or SENDBLUE_API_API_KEY")
    if not settings.sendblue_api_secret:
        missing.append("SENDBLUE_API_SECRET or SENDBLUE_API_API_SECRET")
    if not settings.sendblue_from_number:
        missing.append("SENDBLUE_FROM_NUMBER")
    if not settings.sendblue_allowed_e164:
        missing.append("SENDBLUE_ALLOWED_E164")
    if not settings.sendblue_owner_email:
        missing.append("SENDBLUE_OWNER_EMAIL")
    return missing


def _verify_webhook_secret(request: Request) -> None:
    expected = (settings.sendblue_webhook_secret or "").strip()
    if not expected:
        return
    candidates = [
        request.headers.get("sb-webhook-secret"),
        request.headers.get("SB-Webhook-Secret"),
        request.headers.get("X-Webhook-Secret"),
        request.headers.get("x-webhook-secret"),
        request.headers.get("X-Sendblue-Webhook-Secret"),
    ]
    if expected not in {c for c in candidates if c}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )


def _sms_plain(text: str, max_len: int = 8000) -> str:
    t = (text or "").strip()
    if not t:
        return " "
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    if len(t) > max_len:
        t = t[: max_len - 1] + "…"
    return t


def _send_message_sync(*, content: str, to_number: str) -> None:
    from sendblue_api import SendblueAPI

    assert settings.sendblue_api_key and settings.sendblue_api_secret
    client = SendblueAPI(
        api_key=settings.sendblue_api_key,
        api_secret=settings.sendblue_api_secret,
    )
    client.messages.send(
        content=content,
        from_number=settings.sendblue_from_number or "",
        number=to_number,
    )


def sendblue_outbound_configured() -> bool:
    """True when the Sendblue SDK can send SMS (webhook-only env vars not required)."""
    return bool(
        settings.sendblue_api_key
        and settings.sendblue_api_secret
        and (settings.sendblue_from_number or "").strip()
    )


async def send_sendblue_text_async(*, to_number: str, content: str) -> None:
    """Best-effort outbound SMS; no-ops if not configured; logs failures."""
    to_number = (to_number or "").strip()
    content = (content or "").strip()
    if not to_number or not content:
        return
    if not sendblue_outbound_configured():
        logger.debug("sendblue outbound skipped: missing API key, secret, or from number")
        return
    plain = _sms_plain(content, max_len=480)
    try:
        await asyncio.to_thread(
            _send_message_sync,
            content=plain,
            to_number=to_number,
        )
    except Exception:
        logger.exception("sendblue outbound failed to=%s", to_number)


async def send_phone_saved_welcome_sms(*, to_e164: str) -> None:
    """Welcome text after the user saves `phone_e164` in the web app."""
    msg = (
        "Ally here — your number is saved. Text this line anytime; "
        "it stays linked to the same account as the web app."
    )
    await send_sendblue_text_async(to_number=to_e164, content=msg)


async def _resolve_owner_user(db: AsyncSession) -> User | None:
    email = (settings.sendblue_owner_email or "").strip().lower()
    if not email:
        return None
    r = await db.execute(select(User).where(func.lower(User.email) == email))
    return r.scalar_one_or_none()


async def _get_or_create_sendblue_conversation(
    db: AsyncSession, *, user: User
) -> uuid.UUID:
    if user.sendblue_conversation_id:
        conv = await get_owned_conversation(
            db,
            user_id=user.id,
            conversation_id=user.sendblue_conversation_id,
        )
        if conv is not None:
            return conv.id
        user.sendblue_conversation_id = None
    conv = await create_conversation(
        db,
        user_id=user.id,
        title="SMS & iMessage with Ally",
    )
    user.sendblue_conversation_id = conv.id
    await db.flush()
    return conv.id


async def process_sendblue_inbound(
    db: AsyncSession,
    *,
    request: Request,
    payload: dict[str, Any],
) -> None:
    _verify_webhook_secret(request)

    if payload.get("is_outbound") is True:
        logger.debug("sendblue skip outbound callback")
        return

    # Only skip real group threads — strict allowlist ("message" only) drops some 1:1 payloads.
    mt = _sendblue_message_type_normalized(payload.get("message_type"))
    gid = _sendblue_payload_str(payload, "group_id")
    if gid or mt == "group":
        logger.info(
            "sendblue skip group message group_id=%s message_type=%s",
            gid or "(empty)",
            mt or "(empty)",
        )
        return

    handle = str(payload.get("message_handle") or "").strip()
    if not handle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing message_handle",
        )

    content = str(payload.get("content") or "").strip()
    media = str(payload.get("media_url") or "").strip()
    if not content and media:
        content = "[User sent media only; describe or ask them to type a question.]"

    if not content:
        logger.info(
            "sendblue skip empty content status=%r message_type=%r",
            payload.get("status"),
            mt,
        )
        return

    caller = str(payload.get("from_number") or payload.get("number") or "").strip()
    allow = normalize_e164(settings.sendblue_allowed_e164 or "")
    if normalize_e164(caller) != allow:
        logger.warning("sendblue rejected caller=%s expected=%s", caller, allow)
        return

    user = await _resolve_owner_user(db)
    if user is None:
        logger.error(
            "sendblue no user for SENDBLUE_OWNER_EMAIL=%s",
            settings.sendblue_owner_email,
        )
        return

    try:
        db.add(SendblueInboundDedupe(message_handle=handle[:160]))
        await db.flush()
    except IntegrityError:
        await db.rollback()
        logger.debug("sendblue duplicate message_handle=%s", handle)
        return

    creds = _credentials_from_user(user)
    if creds is None:
        logger.error("sendblue user %s has no Google refresh token", user.id)
        await db.commit()
        await asyncio.to_thread(
            _send_message_sync,
            content="Sign in to Ally in the browser once so Google can connect, then text again.",
            to_number=allow,
        )
        return

    if not creds.valid:
        creds.refresh(GoogleAuthRequest())

    conv_id = await _get_or_create_sendblue_conversation(db, user=user)
    _conv, prior_msgs = await load_conversation_messages(
        db, user_id=user.id, conversation_id=conv_id
    )
    history: list[dict[str, str]] = []
    for m in prior_msgs:
        if m.role in ("user", "assistant"):
            history.append({"role": m.role, "content": m.content})
    history = history[-20:]

    try:
        reply, _action = await run_chat(content, history, creds)
    except Exception:
        logger.exception("sendblue Claude failed")
        reply = "Sorry — I could not complete that request. Try again in a moment."

    text = (reply or "").strip() or " "
    conv = await get_owned_conversation(db, user_id=user.id, conversation_id=conv_id)
    if conv is None:
        await db.rollback()
        raise RuntimeError("sendblue conversation disappeared")
    await append_pair(
        db,
        conversation=conv,
        user_text=content,
        assistant_text=text,
    )
    await db.commit()

    outbound = _sms_plain(text)
    try:
        await asyncio.to_thread(
            _send_message_sync,
            content=outbound,
            to_number=allow,
        )
    except Exception:
        logger.exception("sendblue outbound send failed (reply was saved)")
