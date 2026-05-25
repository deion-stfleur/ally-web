from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ScheduledJob, User
from services import gmail_service
from services.chat_persist import append_pair, get_owned_conversation, load_conversation_messages
from services.claude_service import ReceiptDefaults, run_chat, split_reply_and_action
from services.google_auth import GOOGLE_TOKEN_URL
from services.google_token_crypto import decrypt_refresh_token
from services.profile_memory_service import extract_profile_from_conversation
from services.schedule_service import (
    JOB_AGENT_TASK_SMS,
    JOB_EXTRACT_USER_PROFILE,
    JOB_SEND_GMAIL,
)
from services.watch_rules_service import ALL_QUIET_PREFIX, apply_watch_job_result

logger = logging.getLogger(__name__)


def _credentials_from_user(user: User) -> Credentials | None:
    rt = decrypt_refresh_token(user.google_refresh_token_encrypted)
    if not rt:
        return None
    scopes = (
        user.google_scopes.split() if (user.google_scopes or "").strip() else None
    )
    return Credentials(
        token=None,
        refresh_token=rt,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
    )


async def _claim_next_job_id(session: AsyncSession) -> uuid.UUID | None:
    now = datetime.now(timezone.utc)
    row = await session.execute(
        text(
            """
WITH cte AS (
    SELECT id FROM scheduled_jobs
    WHERE status = 'pending' AND run_at <= :now
      AND job_type != 'browser_task'
    ORDER BY run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE scheduled_jobs AS j
SET status = 'processing', updated_at = NOW()
FROM cte
WHERE j.id = cte.id
RETURNING j.id
"""
        ),
        {"now": now},
    )
    rid = row.scalar_one_or_none()
    return rid if rid is None else uuid.UUID(str(rid))


async def _run_agent_task_sms(session: AsyncSession, job: ScheduledJob) -> None:
    user = await session.get(User, job.user_id)
    if user is None:
        raise RuntimeError("user missing")
    p = job.payload_json or {}
    instruction = str(p.get("instruction") or "").strip()
    if not instruction:
        raise RuntimeError("missing instruction")

    conv_uuid: uuid.UUID | None = None
    raw_cid = p.get("conversation_id")
    if raw_cid:
        try:
            conv_uuid = uuid.UUID(str(raw_cid))
        except (ValueError, TypeError):
            conv_uuid = None

    creds = _credentials_from_user(user)
    if creds is not None:
        if not creds.valid:
            try:
                creds.refresh(GoogleAuthRequest())
            except RefreshError:
                logger.warning(
                    "agent_task job %s: Google refresh failed; running without Google tools",
                    job.id,
                )
                creds = None

    history: list[dict[str, str]] = []
    if conv_uuid is not None:
        oc = await get_owned_conversation(
            session, user_id=user.id, conversation_id=conv_uuid
        )
        if oc is not None:
            _c, msgs = await load_conversation_messages(
                session, user_id=user.id, conversation_id=conv_uuid
            )
            for m in msgs:
                if m.role in ("user", "assistant"):
                    history.append({"role": m.role, "content": m.content})
            history = history[-30:]

    rd = ReceiptDefaults(
        spreadsheet_id=(user.default_receipts_spreadsheet_id or "").strip() or None,
        sheet_range=(user.default_receipts_sheet_range or "").strip() or "Sheet1!A:Z",
        confirm_before_append=bool(user.receipts_confirm_before_append),
    )

    from services.site_service import SiteToolContext

    site_ctx = SiteToolContext(user_id=user.id, db=session)

    reply, _action = await run_chat(
        instruction,
        history,
        creds,
        receipt_defaults=rd,
        enable_google_tools=creds is not None,
        mcp_user_id=str(user.id),
        site_ctx=site_ctx,
    )
    cleaned, _nested = split_reply_and_action(reply or "")
    body = (cleaned or (reply or "")).strip() or "(no text reply)"

    watch_rule_id_raw = p.get("watch_rule_id")
    watch_rule_id: uuid.UUID | None = None
    if watch_rule_id_raw:
        try:
            watch_rule_id = uuid.UUID(str(watch_rule_id_raw))
        except (ValueError, TypeError):
            watch_rule_id = None
    if watch_rule_id is not None:
        await apply_watch_job_result(session, rule_id=watch_rule_id, reply_body=body)

    if conv_uuid is not None:
        conv = await get_owned_conversation(
            session, user_id=user.id, conversation_id=conv_uuid
        )
        if conv is not None:
            shown = instruction[:2000] + ("…" if len(instruction) > 2000 else "")
            await append_pair(
                session,
                conversation=conv,
                user_text=f"[background task]\n{shown}",
                assistant_text=body,
            )

    phone = (user.phone_e164 or "").strip()
    if phone:
        if watch_rule_id is not None and body.upper().startswith(ALL_QUIET_PREFIX):
            logger.info("watch rule %s: ALL_QUIET — skipping SMS", watch_rule_id)
        else:
            # Lazy import: sendblue_webhook_service imports job_runner for credentials.
            from services.sendblue_webhook_service import send_sendblue_text_async

            prefix = "ally — update:" if watch_rule_id is not None else "ally — done:"
            await send_sendblue_text_async(
                to_number=phone,
                content=f"{prefix}\n{body}",
            )


async def _run_extract_user_profile(session: AsyncSession, job: ScheduledJob) -> None:
    user = await session.get(User, job.user_id)
    if user is None:
        raise RuntimeError("user missing")
    p = job.payload_json or {}
    raw_cid = p.get("conversation_id")
    if not raw_cid:
        raise RuntimeError("missing conversation_id")
    try:
        conv_id = uuid.UUID(str(raw_cid))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("invalid conversation_id") from exc
    await extract_profile_from_conversation(
        session, user=user, conversation_id=conv_id
    )


async def _run_send_gmail(session: AsyncSession, job: ScheduledJob) -> None:
    user = await session.get(User, job.user_id)
    if user is None:
        raise RuntimeError("user missing")
    creds = _credentials_from_user(user)
    if creds is None:
        raise RuntimeError(
            "No stored Google refresh token for this user. "
            "Sign out and sign in again with Google (include offline access / refresh token)."
        )
    if not creds.valid:
        creds.refresh(GoogleAuthRequest())
    p = job.payload_json
    gmail_service.send_email(
        creds,
        str(p["to"]),
        str(p["subject"]),
        str(p["body"]),
        p.get("thread_id"),
    )


async def process_one_job(session: AsyncSession, job_id: uuid.UUID) -> None:
    job = await session.get(ScheduledJob, job_id)
    if job is None or job.status != "processing":
        return
    try:
        if job.job_type == JOB_SEND_GMAIL:
            await _run_send_gmail(session, job)
        elif job.job_type == JOB_AGENT_TASK_SMS:
            await _run_agent_task_sms(session, job)
        elif job.job_type == JOB_EXTRACT_USER_PROFILE:
            await _run_extract_user_profile(session, job)
        else:
            raise RuntimeError(f"unknown job_type: {job.job_type}")
        job.status = "completed"
        job.last_error = None
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        job.status = "failed"
        job.last_error = str(exc)[:8000]
    job.updated_at = datetime.now(timezone.utc)


async def run_due_jobs_once(session: AsyncSession) -> bool:
    async with session.begin():
        job_id = await _claim_next_job_id(session)
    if job_id is None:
        return False
    async with session.begin():
        await process_one_job(session, job_id)
    return True
