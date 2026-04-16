from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from deps import get_current_session
from models.schemas import QuickRequestItem, QuickRequestsResponse
from services.quick_requests_service import build_actionable_quick_requests
from services.session_store import UserSession

router = APIRouter(prefix="/quick-requests", tags=["quick-requests"])


@router.post("", response_model=QuickRequestsResponse)
async def create_quick_requests(
    session: UserSession = Depends(get_current_session),
) -> QuickRequestsResponse:
    """Scan recent inbox threads (7 days, up to 100) and return actionable suggestions."""
    try:
        raw = await build_actionable_quick_requests(session.credentials)
    except RuntimeError as exc:
        msg = str(exc)
        code = (
            status.HTTP_502_BAD_GATEWAY
            if "Could not rank quick requests" in msg
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=code, detail=msg) from exc

    items: list[QuickRequestItem] = []
    for row in raw:
        try:
            items.append(QuickRequestItem(**row))
        except ValidationError:
            continue
    return QuickRequestsResponse(items=items)
