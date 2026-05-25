"""Internal callbacks from Railway browser-worker (shared secret)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from deps import get_db_optional
from services.browser_job_service import complete_browser_job

router = APIRouter(prefix="/internal/browser-jobs", tags=["internal-browser"])


class BrowserJobCompleteRequest(BaseModel):
    job_id: uuid.UUID
    status: str = Field(..., pattern="^(completed|failed)$")
    result_text: str | None = Field(default=None, max_length=12000)
    error: str | None = Field(default=None, max_length=8000)


def _verify_internal_secret(
    x_ally_internal_secret: str | None = Header(default=None, alias="X-Ally-Internal-Secret"),
) -> None:
    expected = (settings.ally_internal_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal browser callbacks are not configured.",
        )
    if (x_ally_internal_secret or "").strip() != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret.")


@router.post("/complete")
async def browser_job_complete(
    body: BrowserJobCompleteRequest,
    db: AsyncSession | None = Depends(get_db_optional),
    _: None = Depends(_verify_internal_secret),
) -> dict[str, str]:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    try:
        await complete_browser_job(
            db,
            job_id=body.job_id,
            status=body.status,
            result_text=body.result_text,
            error=body.error,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception:
        await db.rollback()
        raise
    return {"ok": "true"}
