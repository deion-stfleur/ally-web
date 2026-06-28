from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import WaitlistSignup
from deps import get_db
from models.schemas import WaitlistSignupRequest, WaitlistSignupResponse
from services.waitlist_notify import notify_waitlist_signup

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


def _normalize_email(raw: str) -> str:
    return raw.strip().lower()


@router.post("", response_model=WaitlistSignupResponse)
async def join_waitlist(
    body: WaitlistSignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> WaitlistSignupResponse:
    email = _normalize_email(body.email)
    name = body.name.strip() if body.name else None
    company = body.company.strip() if body.company else None
    use_case = body.use_case.strip() if body.use_case else None
    source = body.source.strip() if body.source else None

    existing = (
        await db.execute(select(WaitlistSignup).where(WaitlistSignup.email == email))
    ).scalar_one_or_none()
    if existing:
        return WaitlistSignupResponse(
            ok=True,
            already_registered=True,
            message="You're already on the waitlist. We'll email you when access is ready.",
        )

    row = WaitlistSignup(
        id=uuid.uuid4(),
        email=email,
        name=name,
        company=company,
        use_case=use_case,
        source=source,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return WaitlistSignupResponse(
            ok=True,
            already_registered=True,
            message="You're already on the waitlist. We'll email you when access is ready.",
        )

    background_tasks.add_task(
        notify_waitlist_signup,
        email=email,
        name=name,
        company=company,
        use_case=use_case,
        source=source,
    )
    return WaitlistSignupResponse(
        ok=True,
        already_registered=False,
        message="You're on the list. We'll email you when your account is ready.",
    )
