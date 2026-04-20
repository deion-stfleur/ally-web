from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from services.sendblue_webhook_service import (
    process_sendblue_inbound,
    sendblue_integration_ready,
    sendblue_missing_env,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/sendblue", tags=["sendblue"])


@router.get("/status")
def sendblue_status() -> dict[str, object]:
    """Which Sendblue env vars are missing (safe for ngrok curl while debugging)."""
    missing = sendblue_missing_env()
    return {"ready": len(missing) == 0, "missing": missing}


@router.post("", response_class=PlainTextResponse)
async def sendblue_receive(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    """Sendblue `receive` webhook — no JWT (optional shared secret in headers)."""
    if not sendblue_integration_ready():
        miss = sendblue_missing_env()
        logger.error(
            "Sendblue POST rejected: incomplete config (missing: %s). "
            "Set these on Heroku Config Vars or backend/.env.",
            ", ".join(miss) if miss else "(unknown)",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "sendblue_not_configured",
                "missing": miss,
            },
        )

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected JSON body",
        ) from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    try:
        await process_sendblue_inbound(db, request=request, payload=payload)
    except HTTPException:
        raise
    except Exception:
        logger.exception("sendblue inbound handler crashed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="sendblue handler error",
        ) from None

    return PlainTextResponse("ok", status_code=200)
