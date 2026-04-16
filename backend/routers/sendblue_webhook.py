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
        logger.warning(
            "Sendblue POST ignored: incomplete env (missing: %s). Restart uvicorn after editing backend/.env.",
            ", ".join(miss) if miss else "(unknown)",
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected JSON body",
        ) from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    await process_sendblue_inbound(db, request=request, payload=payload)
    return PlainTextResponse("ok", status_code=200)
