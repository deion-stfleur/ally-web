"""Browser Use jobs (Pro only): queued in Postgres, run on Railway browser-worker."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ScheduledJob, User
from services.chat_persist import append_pair, get_owned_conversation
from services.schedule_service import JOB_BROWSER_TASK

logger = logging.getLogger(__name__)

PRO_REQUIRED_MSG = (
    "browser automation is ally pro only — upgrade at "
    f"{settings.frontend_url.rstrip('/')}/pricing"
)


def extract_browser_result_text(history: object) -> str:
    """Best-effort final text from browser-use AgentHistory."""
    if history is None:
        return ""
    for attr in ("final_result", "final_message", "extracted_content"):
        val = getattr(history, attr, None)
        if val is not None:
            s = str(val).strip()
            if s:
                return s[:8000]
    if hasattr(history, "history") and history.history:
        last = history.history[-1]
        if hasattr(last, "result") and last.result:
            return str(last.result).strip()[:8000]
    return str(history).strip()[:8000]


async def complete_browser_job(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    status: str,
    result_text: str | None = None,
    error: str | None = None,
) -> None:
    """Mark job done and SMS user (called from internal API after Railway worker)."""
    job = await session.get(ScheduledJob, job_id)
    if job is None or job.job_type != JOB_BROWSER_TASK:
        raise ValueError("browser job not found")
    user = await session.get(User, job.user_id)
    if user is None:
        raise ValueError("user missing")

    st = (status or "").strip().lower()
    if st not in ("completed", "failed"):
        raise ValueError("status must be completed or failed")

    job.status = st
    job.last_error = (error or None)[:8000] if error else None
    job.updated_at = datetime.now(timezone.utc)

    p = job.payload_json or {}
    body = (result_text or "").strip()
    if st == "failed":
        body = (error or body or "browser task failed").strip()[:2000]

    conv_uuid: uuid.UUID | None = None
    raw_cid = p.get("conversation_id")
    if raw_cid:
        try:
            conv_uuid = uuid.UUID(str(raw_cid))
        except (ValueError, TypeError):
            conv_uuid = None

    if conv_uuid is not None:
        conv = await get_owned_conversation(
            session, user_id=user.id, conversation_id=conv_uuid
        )
        if conv is not None:
            task_preview = str(p.get("task") or "")[:2000]
            await append_pair(
                session,
                conversation=conv,
                user_text=f"[browser task]\n{task_preview}",
                assistant_text=body or "(no result)",
            )

    phone = (user.phone_e164 or "").strip()
    if phone:
        from services.sendblue_webhook_service import send_sendblue_text_async

        if st == "completed" and body:
            sms = f"ally — site check done:\n{body}"
        else:
            sms = f"ally — couldn't finish that site task. {body or 'try again or use a link.'}"
        await send_sendblue_text_async(to_number=phone, content=sms[:1500])

    await session.flush()
