from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import User
from deps import get_current_session, get_db, get_db_optional
from models.schemas import (
    AuthTokenResponse,
    GoogleAuthRequest,
    ReceiptSettingsPatch,
    UpdatePhoneRequest,
    UserMeResponse,
)
from services import google_auth as google_auth_service
from services.chat_persist import (
    google_sub_from_userinfo,
    resolve_db_user_id,
    upsert_app_user,
)
from services.google_token_crypto import encrypt_refresh_token
from services.phone_e164 import normalize_e164
from services.sendblue_webhook_service import send_phone_saved_welcome_sms
from services.session_store import UserSession, delete_session, save_session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthTokenResponse)
async def auth_google(
    body: GoogleAuthRequest,
    db: AsyncSession | None = Depends(get_db_optional),
) -> AuthTokenResponse:
    redirect_uri = (body.redirect_uri or settings.google_redirect_uri).strip()
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri is required (in body or GOOGLE_REDIRECT_URI).",
        )
    try:
        token_payload = await google_auth_service.exchange_authorization_code(
            body.code, redirect_uri
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    credentials = google_auth_service.credentials_from_token_response(token_payload)
    access = token_payload.get("access_token")
    if not access:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google response missing access_token",
        )

    userinfo = await google_auth_service.fetch_google_userinfo(access)
    google_sub = google_sub_from_userinfo(userinfo)
    db_user_id = None
    if db is not None and google_sub:
        row = await upsert_app_user(
            db,
            google_sub=google_sub,
            email=userinfo.get("email"),
            name=userinfo.get("name"),
            picture=userinfo.get("picture"),
        )
        if credentials.refresh_token:
            row.google_refresh_token_encrypted = encrypt_refresh_token(
                credentials.refresh_token
            )
        scope_str = (token_payload.get("scope") or "").strip()
        if scope_str:
            row.google_scopes = scope_str
        await db.commit()
        db_user_id = row.id

    session_id = str(uuid.uuid4())
    session = UserSession(
        id=session_id,
        credentials=credentials,
        email=userinfo.get("email"),
        name=userinfo.get("name"),
        picture=userinfo.get("picture"),
        google_sub=google_sub,
        db_user_id=db_user_id,
    )
    save_session(session_id, session)

    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    token = jwt.encode(
        {"sub": session_id, "exp": int(expire.timestamp())},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return AuthTokenResponse(access_token=token)


@router.get("/me", response_model=UserMeResponse)
async def auth_me(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession | None = Depends(get_db_optional),
) -> UserMeResponse:
    phone_e164: str | None = None
    default_receipts_spreadsheet_id: str | None = None
    default_receipts_sheet_range: str | None = None
    receipts_confirm_before_append = True
    if db is not None:
        user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
        if user_id is not None:
            r = await db.execute(select(User).where(User.id == user_id))
            row = r.scalar_one_or_none()
            if row is not None:
                phone_e164 = row.phone_e164
                default_receipts_spreadsheet_id = row.default_receipts_spreadsheet_id
                default_receipts_sheet_range = row.default_receipts_sheet_range
                receipts_confirm_before_append = bool(row.receipts_confirm_before_append)
    return UserMeResponse(
        email=session.email,
        name=session.name,
        picture=session.picture,
        phone_e164=phone_e164,
        default_receipts_spreadsheet_id=default_receipts_spreadsheet_id,
        default_receipts_sheet_range=default_receipts_sheet_range,
        receipts_confirm_before_append=receipts_confirm_before_append,
    )


@router.patch("/me/phone", response_model=UserMeResponse)
async def auth_update_phone(
    body: UpdatePhoneRequest,
    background_tasks: BackgroundTasks,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    normalized = normalize_e164(body.phone)
    if not normalized or len(normalized) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid phone number with country code (e.g. +15551234567).",
        )
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found; sign in again from the web app.",
        )
    r = await db.execute(select(User).where(User.id == user_id))
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    previous_phone = row.phone_e164
    row.phone_e164 = normalized
    row.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That phone number is already linked to another account.",
        ) from None
    await db.refresh(row)
    if previous_phone != normalized:
        background_tasks.add_task(send_phone_saved_welcome_sms, to_e164=normalized)
    return UserMeResponse(
        email=session.email,
        name=session.name,
        picture=session.picture,
        phone_e164=row.phone_e164,
        default_receipts_spreadsheet_id=row.default_receipts_spreadsheet_id,
        default_receipts_sheet_range=row.default_receipts_sheet_range,
        receipts_confirm_before_append=bool(row.receipts_confirm_before_append),
    )


@router.patch("/me/receipt-settings", response_model=UserMeResponse)
async def auth_patch_receipt_settings(
    body: ReceiptSettingsPatch,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> UserMeResponse:
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found; sign in again from the web app.",
        )
    r = await db.execute(select(User).where(User.id == user_id))
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    data = body.model_dump(exclude_unset=True)
    if "default_receipts_spreadsheet_id" in data:
        v = data["default_receipts_spreadsheet_id"]
        row.default_receipts_spreadsheet_id = (
            (v or "").strip() or None if v is not None else None
        )
    if "default_receipts_sheet_range" in data:
        v = data["default_receipts_sheet_range"]
        row.default_receipts_sheet_range = (
            (v or "").strip() or None if v is not None else None
        )
    if "receipts_confirm_before_append" in data:
        v = data["receipts_confirm_before_append"]
        if v is not None:
            row.receipts_confirm_before_append = bool(v)
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return UserMeResponse(
        email=session.email,
        name=session.name,
        picture=session.picture,
        phone_e164=row.phone_e164,
        default_receipts_spreadsheet_id=row.default_receipts_spreadsheet_id,
        default_receipts_sheet_range=row.default_receipts_sheet_range,
        receipts_confirm_before_append=bool(row.receipts_confirm_before_append),
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove the signed-in user row (cascades chats, todos, jobs) and invalidate the session."""
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is not None:
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(sendblue_conversation_id=None)
        )
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()
    delete_session(session.id)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def auth_logout(session: UserSession = Depends(get_current_session)) -> None:
    delete_session(session.id)