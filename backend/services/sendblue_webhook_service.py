from __future__ import annotations

import asyncio
import base64
import logging
import re
import uuid
from typing import Any

import httpx
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
from services.claude_service import ReceiptDefaults, run_chat
from services.job_runner import _credentials_from_user

logger = logging.getLogger(__name__)

_MEDIA_MAX_BYTES = 5_500_000


async def _fetch_sendblue_media_as_image_parts(
    media_url: str,
) -> list[tuple[str, str]]:
    url = (media_url or "").strip()
    if not url:
        return []
    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        body = resp.content
        ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
    if len(body) > _MEDIA_MAX_BYTES:
        raise ValueError("media too large")
    mt_map = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/gif": "image/gif",
        "image/webp": "image/webp",
    }
    media_type = mt_map.get(ct, "image/jpeg")
    b64 = base64.standard_b64encode(body).decode("ascii")
    return [(media_type, b64)]


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
        return

    if (payload.get("message_type") or "").lower() not in ("", "message"):
        return

    gid = (payload.get("group_id") or "").strip()
    if gid:
        logger.info("sendblue skip group message group_id=%s", gid)
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

    image_parts: list[tuple[str, str]] | None = None
    if media:
        try:
            image_parts = await _fetch_sendblue_media_as_image_parts(media)
        except Exception:
            logger.exception("sendblue media fetch failed url=%s", media[:120])
            image_parts = None

    line = (content or "").strip()
    if image_parts and line.startswith("[User sent media"):
        line = (
            "Extract this receipt from the image. Apply Ally receipt rules "
            "(Sheets default, confirm if configured, Drive only if I ask)."
        )

    rd = ReceiptDefaults(
        spreadsheet_id=(user.default_receipts_spreadsheet_id or "").strip() or None,
        sheet_range=(user.default_receipts_sheet_range or "").strip() or "Sheet1!A:Z",
        confirm_before_append=bool(user.receipts_confirm_before_append),
    )

    try:
        reply, _action = await run_chat(
            line,
            history,
            creds,
            receipt_defaults=rd,
            image_parts=image_parts,
        )
    except Exception:
        logger.exception("sendblue Claude failed")
        reply = "Sorry — I could not complete that request. Try again in a moment."

    text = (reply or "").strip() or " "
    conv = await get_owned_conversation(db, user_id=user.id, conversation_id=conv_id)
    if conv is None:
        await db.rollback()
        raise RuntimeError("sendblue conversation disappeared")
    user_log = content
    if media:
        user_log = f"{content}\n\n[Incoming MMS / image]"
    await append_pair(
        db,
        conversation=conv,
        user_text=user_log,
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
