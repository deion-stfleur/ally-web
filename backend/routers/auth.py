from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from deps import get_current_session, get_db_optional
from models.schemas import AuthTokenResponse, GoogleAuthRequest, UserMeResponse
from services import google_auth as google_auth_service
from services.chat_persist import google_sub_from_userinfo, upsert_app_user
from services.google_token_crypto import encrypt_refresh_token
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
async def auth_me(session: UserSession = Depends(get_current_session)) -> UserMeResponse:
    return UserMeResponse(
        email=session.email,
        name=session.name,
        picture=session.picture,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def auth_logout(session: UserSession = Depends(get_current_session)) -> None:
    delete_session(session.id)