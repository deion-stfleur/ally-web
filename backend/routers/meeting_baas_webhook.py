from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from fastapi.responses import PlainTextResponse

from services.meeting_baas_service import (
    meeting_baas_configured,
    process_meeting_webhook_payload,
    verify_webhook_request,
)
from db import session as db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/meeting-baas", tags=["meeting-baas"])


@router.get("/status")
def meeting_baas_status() -> dict[str, object]:
    from services.meeting_baas_service import meeting_webhook_url

    return {
        "configured": meeting_baas_configured(),
        "webhook_url": meeting_webhook_url(),
        "api_version": "v2",
        "setup_doc": "docs/MEETING_BAAS_SETUP.md",
        "callback_config": {"url": meeting_webhook_url()},
    }


async def _process_webhook_payload(payload: dict) -> None:
    if db_session.async_session_maker is None:
        return
    async with db_session.async_session_maker() as db:
        try:
            await process_meeting_webhook_payload(db, payload)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("meeting baas webhook processing failed")


@router.post("", response_class=PlainTextResponse)
async def meeting_baas_receive(
    request: Request,
    background_tasks: BackgroundTasks,
) -> PlainTextResponse:
    if not meeting_baas_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MEETING_BAAS_API_KEY not configured",
        )
    try:
        verify_webhook_request(request)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid body")

    background_tasks.add_task(_process_webhook_payload, payload)
    return PlainTextResponse("ok", status_code=200)
