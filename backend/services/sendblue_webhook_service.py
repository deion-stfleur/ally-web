from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleAuthRequest
from fastapi import HTTPException, Request, status
from sqlalchemy import select
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
from services.site_service import SiteToolContext
from services.job_runner import _credentials_from_user
from models.schemas import BrowserTaskActionPayload, RegisterWatchActionPayload
from services.browser_job_service import PRO_REQUIRED_MSG
from services.billing_plans import STARTER_REQUIRED_MSG, user_has_starter_or_pro
from services.schedule_service import (
    TASK_RUNNER_DAILY_LIMIT_MSG,
    create_agent_task_job,
    create_browser_task_job,
)
from services.user_profile_service import (
    ONBOARDING_QUESTION,
    clear_proactive_awaiting_reply,
    get_or_create_profile,
    maybe_capture_update_preference,
    schedule_memory_extraction,
)
from services.watch_rules_service import create_watch_rule as create_watch_rule_row
from services.meeting_calendar_auto_join_service import (
    try_handle_calendar_auto_join_preference_sms,
)
from services.meeting_baas_service import try_handle_meeting_join_sms

logger = logging.getLogger(__name__)


class SendblueNotConfiguredError(RuntimeError):
    """Outbound SMS is not configured (missing API key, secret, or from number)."""


class SendblueDeliveryError(RuntimeError):
    """Sendblue rejected or failed an outbound message."""

    def __init__(self, message: str, *, user_message: str | None = None) -> None:
        super().__init__(message)
        self.user_message = user_message or message


def _stripe_sms_gating_enabled() -> bool:
    """When Stripe billing is configured, inbound SMS requires an active subscription."""
    from services.billing_plans import stripe_billing_configured

    return stripe_billing_configured()


def _user_sms_plan_active(user: User) -> bool:
    from services.billing_plans import subscription_is_active

    return subscription_is_active(user.stripe_subscription_status)


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


def _sendblue_auth_headers() -> dict[str, str]:
    assert settings.sendblue_api_key and settings.sendblue_api_secret
    return {
        "sb-api-key-id": settings.sendblue_api_key,
        "sb-api-secret-key": settings.sendblue_api_secret,
        "Content-Type": "application/json",
    }


def _upsert_sendblue_contact_sync(*, phone_e164: str) -> None:
    """Register recipient in Sendblue before OTP (required on some plans)."""
    import httpx

    body: dict[str, object] = {
        "number": phone_e164,
        "update_if_exists": True,
    }
    from_num = (settings.sendblue_from_number or "").strip()
    if from_num:
        body["sendblue_number"] = from_num
    with httpx.Client(timeout=20.0) as client:
        resp = client.post(
            "https://api.sendblue.co/api/v2/contacts",
            headers=_sendblue_auth_headers(),
            json=body,
        )
        if resp.status_code >= 400:
            logger.warning(
                "sendblue contact upsert failed status=%s body=%s",
                resp.status_code,
                resp.text[:300],
            )


async def ensure_sendblue_contact_async(*, phone_e164: str) -> None:
    if not sendblue_outbound_configured():
        return
    try:
        await asyncio.to_thread(_upsert_sendblue_contact_sync, phone_e164=phone_e164)
    except Exception:
        logger.exception("sendblue contact upsert failed to=%s", phone_e164)


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


def _sendblue_delivery_user_message(exc: Exception) -> str:
    raw = str(exc).lower()
    from_num = (settings.sendblue_from_number or "").strip()
    from_hint = f" ({from_num})" if from_num else ""
    if "must be verified" in raw or "contact must be verified" in raw:
        return (
            "We could not text a login code to this number yet. On our messaging plan, new numbers "
            f"must text Ally once{from_hint} before we can message them, or use Sign in with Google "
            "(recommended). After Google sign-in you can add your phone in the app."
        )
    return (
        "We could not send the verification text. Check your number includes country code "
        "(e.g. +1…) and try again in a minute."
    )


async def send_sendblue_text_async(
    *,
    to_number: str,
    content: str,
    raise_on_failure: bool = False,
) -> bool:
    """Outbound SMS. Returns True on success. No-ops when not configured unless raise_on_failure."""
    to_number = (to_number or "").strip()
    content = (content or "").strip()
    if not to_number or not content:
        if raise_on_failure:
            raise SendblueDeliveryError("empty to_number or content")
        return False
    if not sendblue_outbound_configured():
        logger.debug("sendblue outbound skipped: missing API key, secret, or from number")
        if raise_on_failure:
            raise SendblueNotConfiguredError("sendblue outbound not configured")
        return False
    plain = _sms_plain(content, max_len=480)
    try:
        await asyncio.to_thread(
            _send_message_sync,
            content=plain,
            to_number=to_number,
        )
        return True
    except Exception as exc:
        logger.exception("sendblue outbound failed to=%s", to_number)
        if raise_on_failure:
            raise SendblueDeliveryError(
                str(exc),
                user_message=_sendblue_delivery_user_message(exc),
            ) from exc
        return False


async def send_phone_saved_welcome_sms(*, to_e164: str) -> None:
    """Optional welcome after phone save. May fail until the user texts this line first (Sendblue)."""
    msg = (
        "Ally: your number is saved on the web app. Reply here anytime — "
        "if you do not see this, send Hi Ally to this number first from your phone."
    )
    try:
        await send_sendblue_text_async(to_number=to_e164, content=msg)
    except Exception:
        logger.info(
            "welcome SMS skipped or failed (user may need to text first) to=%s",
            to_e164,
        )


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
        # Same URL often receives status updates for sends (QUEUED/SENT/etc.). Not an inbound SMS.
        logger.info(
            "sendblue webhook ignored (outbound/status): status=%s service=%r handle=%s",
            payload.get("status"),
            payload.get("service"),
            str(payload.get("message_handle") or "")[:40],
        )
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

    caller_raw = str(payload.get("from_number") or payload.get("number") or "").strip()
    caller = normalize_e164(caller_raw)
    if not caller:
        logger.warning("sendblue missing/invalid caller from_number=%r number=%r", payload.get("from_number"), payload.get("number"))
        return

    # Phone-first: route inbound by verified user phone.
    r_user = await db.execute(select(User).where(User.phone_e164 == caller))
    user = r_user.scalar_one_or_none()
    if user is None or user.phone_verified_at is None:
        logger.info("sendblue unknown phone=%s; prompting signup", caller)
        if sendblue_outbound_configured():
            try:
                link = f"{settings.frontend_url.rstrip('/')}/login"
                await asyncio.to_thread(
                    _send_message_sync,
                    content=_sms_plain(
                        f"Welcome to Ally. Please sign up first: {link} (verify this phone), then text again.",
                        max_len=480,
                    ),
                    to_number=caller,
                )
            except Exception:
                logger.exception("sendblue signup prompt SMS failed")
        return

    try:
        db.add(SendblueInboundDedupe(message_handle=handle[:160]))
        await db.flush()
    except IntegrityError:
        await db.rollback()
        logger.debug("sendblue duplicate message_handle=%s", handle)
        return

    if _stripe_sms_gating_enabled() and not _user_sms_plan_active(user):
        await db.commit()
        pay_url = f"{settings.frontend_url.rstrip('/')}/pricing"
        msg = (
            "Ally SMS needs an active plan (Standard $19.99/mo or Pro $49.99/mo). "
            f"Subscribe here, then text again: {pay_url}"
        )
        try:
            await asyncio.to_thread(
                _send_message_sync,
                content=_sms_plain(msg, max_len=480),
                to_number=caller,
            )
        except Exception:
            logger.exception("sendblue upsell SMS failed")
        return

    creds = _credentials_from_user(user)
    if creds is None:
        logger.error("sendblue user %s has no Google refresh token", user.id)
        # Still allow non-Google questions (finance/web search) to get a reply.
        creds = None

    if creds is not None and not creds.valid:
        try:
            creds.refresh(GoogleAuthRequest())
        except RefreshError as e:
            # Common: user revoked access in Google Security settings, or refresh token rotated/expired.
            logger.exception("sendblue Google refresh failed user_id=%s", user.id)
            await db.commit()
            # Continue without Google tools so finance/web questions still work over SMS.
            creds = None

    cal_pref_reply = await try_handle_calendar_auto_join_preference_sms(
        db, user=user, message=content
    )
    if cal_pref_reply is not None:
        conv_id = await _get_or_create_sendblue_conversation(db, user=user)
        conv = await get_owned_conversation(db, user_id=user.id, conversation_id=conv_id)
        if conv is None:
            await db.rollback()
            raise RuntimeError("sendblue conversation missing")
        await append_pair(
            db,
            conversation=conv,
            user_text=content,
            assistant_text=cal_pref_reply,
        )
        await db.commit()
        await asyncio.to_thread(
            _send_message_sync,
            content=_sms_plain(cal_pref_reply),
            to_number=caller,
        )
        return

    meeting_reply = await try_handle_meeting_join_sms(db, user=user, message=content)
    if meeting_reply is not None:
        conv_id = await _get_or_create_sendblue_conversation(db, user=user)
        conv = await get_owned_conversation(db, user_id=user.id, conversation_id=conv_id)
        if conv is None:
            await db.rollback()
            raise RuntimeError("sendblue conversation missing")
        await append_pair(
            db,
            conversation=conv,
            user_text=content,
            assistant_text=meeting_reply,
        )
        await db.commit()
        await asyncio.to_thread(
            _send_message_sync,
            content=_sms_plain(meeting_reply),
            to_number=caller,
        )
        return

    conv_id = await _get_or_create_sendblue_conversation(db, user=user)
    _conv, prior_msgs = await load_conversation_messages(
        db, user_id=user.id, conversation_id=conv_id
    )
    is_first_user_message = sum(1 for m in prior_msgs if m.role == "user") == 0
    profile = await get_or_create_profile(db, user=user)
    clear_proactive_awaiting_reply(profile)
    await maybe_capture_update_preference(db, user=user, message=content)
    history: list[dict[str, str]] = []
    for m in prior_msgs:
        if m.role in ("user", "assistant"):
            history.append({"role": m.role, "content": m.content})
    history = history[-20:]

    site_ctx = SiteToolContext(user_id=user.id, db=db)

    action_dict: dict[str, Any] | None = None
    try:
        reply, action_dict = await run_chat(
            content,
            history,
            creds,
            enable_google_tools=creds is not None,
            mcp_user_id=str(user.id),
            site_ctx=site_ctx,
        )
    except Exception:
        logger.exception("sendblue Claude failed")
        reply = "Sorry, I could not complete that request. Try again in a moment."
        action_dict = None

    if isinstance(action_dict, dict) and action_dict.get("action") == "browser_task":
        try:
            bt = BrowserTaskActionPayload.model_validate(action_dict)
            run_at = datetime.now(timezone.utc) + timedelta(seconds=5)
            await create_browser_task_job(
                db,
                user_id=user.id,
                run_at=run_at,
                task=bt.task,
                conversation_id=conv_id,
                start_url=bt.start_url,
            )
            reply = (
                (reply or "").strip() or "checking the site — i'll text you when it's done."
            ).strip()
        except ValueError as exc:
            if str(exc) == "pro_required":
                reply = f"{(reply or '').strip()}\n\n{PRO_REQUIRED_MSG}".strip()
            else:
                reply = f"{(reply or '').strip()}\n\n(couldn't queue browser task: {exc})".strip()
        except Exception:
            logger.exception("sendblue browser_task create failed")
            reply = f"{(reply or '').strip()}\n\n(couldn't queue browser task.)".strip()

    if isinstance(action_dict, dict) and action_dict.get("action") == "background_task":
        instr = str(action_dict.get("instruction") or "").strip()
        if instr:
            try:
                run_at = datetime.now(timezone.utc) + timedelta(seconds=15)
                await create_agent_task_job(
                    db,
                    user_id=user.id,
                    run_at=run_at,
                    instruction=instr,
                    conversation_id=conv_id,
                )
                reply = (reply or "").strip() or "queued — texting you when it's done."
            except ValueError as exc:
                if str(exc) == "daily_limit_reached":
                    reply = f"{(reply or '').strip()}\n\n{TASK_RUNNER_DAILY_LIMIT_MSG}".strip()
                else:
                    reply = f"{(reply or '').strip()}\n\n(couldn't queue: {exc})".strip()
            except Exception:
                logger.exception("sendblue background job create failed")
                reply = (
                    f"{(reply or '').strip()}\n\n(couldn't queue background task.)".strip()
                )

    if isinstance(action_dict, dict) and action_dict.get("action") == "enable_meeting_auto_join":
        from services.meeting_calendar_auto_join_service import set_calendar_auto_join

        if not user_has_starter_or_pro(user):
            reply = f"{(reply or '').strip()}\n\n{STARTER_REQUIRED_MSG}".strip()
        elif user.google_refresh_token_encrypted:
            await set_calendar_auto_join(db, user=user, enabled=True)
            reply = (
                (reply or "").strip()
                + "\n\n(saved — i'll auto-join calendar video meetings when they start.)"
            ).strip()
        else:
            reply = (
                (reply or "").strip()
                + "\n\n(connect google in the app first, then ask again.)"
            ).strip()

    if isinstance(action_dict, dict) and action_dict.get("action") == "disable_meeting_auto_join":
        from services.meeting_calendar_auto_join_service import set_calendar_auto_join

        await set_calendar_auto_join(db, user=user, enabled=False)
        reply = ((reply or "").strip() + "\n\n(stopped calendar auto-join.)").strip()

    if isinstance(action_dict, dict) and action_dict.get("action") == "register_watch":
        try:
            rw = RegisterWatchActionPayload.model_validate(action_dict)
            await create_watch_rule_row(
                db,
                user_id=user.id,
                spec_text=rw.spec,
                time_local=rw.time_local,
                tz_name=rw.timezone,
                watch_mode=rw.mode,
                poll_interval_minutes=rw.poll_interval_minutes,
            )
            mode_label = "instant" if (rw.mode or "").strip().lower() == "instant" else "daily"
            reply = (
                (reply or "").strip() + f"\n\n(saved your {mode_label} SMS watch.)"
            ).strip()
        except ValueError as exc:
            if str(exc) == "starter_required":
                reply = f"{(reply or '').strip()}\n\n{STARTER_REQUIRED_MSG}".strip()
            else:
                reply = f"{(reply or '').strip()}\n\n(watch save failed: {exc})".strip()
        except Exception:
            logger.exception("sendblue register_watch failed")
            reply = f"{(reply or '').strip()}\n\n(watch save failed.)".strip()

    text = (reply or "").strip() or " "
    if is_first_user_message and not profile.onboarding_updates_asked:
        text = f"{text}\n\n{ONBOARDING_QUESTION}".strip()
        profile.onboarding_updates_asked = True
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
    await schedule_memory_extraction(db, user_id=user.id, conversation_id=conv_id)
    await db.commit()

    outbound = _sms_plain(text)
    try:
        await asyncio.to_thread(
            _send_message_sync,
            content=outbound,
            to_number=caller,
        )
    except Exception:
        logger.exception("sendblue outbound send failed (reply was saved)")
