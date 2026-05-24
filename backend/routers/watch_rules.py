from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_current_session, get_db_optional
from models.schemas import (
    CreateWatchRuleRequest,
    WatchRuleOut,
    WatchRuleStatusPatch,
)
from services.chat_persist import resolve_db_user_id
from services.session_store import UserSession
from services.watch_rules_service import (
    create_watch_rule as create_watch_rule_row,
    delete_watch_rule as delete_watch_rule_row,
    list_watch_rules as list_watch_rule_rows,
    set_watch_rule_status,
)

router = APIRouter(prefix="/watch-rules", tags=["watch-rules"])


def _out(row) -> WatchRuleOut:
    return WatchRuleOut(
        id=row.id,
        spec_text=row.spec_text,
        time_local=row.time_local,
        timezone=row.timezone,
        status=row.status,
        watch_mode=getattr(row, "watch_mode", None) or "daily",
        poll_interval_minutes=int(getattr(row, "poll_interval_minutes", None) or 15),
        next_run_at=row.next_run_at,
    )


@router.post("", response_model=WatchRuleOut)
async def create_watch_rule(
    body: CreateWatchRuleRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> WatchRuleOut:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user record — sign out and sign in again after enabling the database.",
        )
    try:
        row = await create_watch_rule_row(
            db,
            user_id=user_id,
            spec_text=body.spec_text,
            time_local=body.time_local,
            tz_name=body.timezone,
            watch_mode=body.watch_mode,
            poll_interval_minutes=body.poll_interval_minutes,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _out(row)


@router.get("", response_model=list[WatchRuleOut])
async def list_watch_rules(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> list[WatchRuleOut]:
    if db is None:
        return []
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        return []
    rows = await list_watch_rule_rows(db, user_id=user_id)
    return [_out(r) for r in rows]


@router.patch("/{rule_id}", response_model=WatchRuleOut)
async def patch_watch_rule(
    rule_id: uuid.UUID,
    body: WatchRuleStatusPatch,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> WatchRuleOut:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    try:
        row = await set_watch_rule_status(
            db, user_id=user_id, rule_id=rule_id, status=body.status
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return _out(row)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watch_rule(
    rule_id: uuid.UUID,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> None:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    ok = await delete_watch_rule_row(db, user_id=user_id, rule_id=rule_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    await db.commit()
