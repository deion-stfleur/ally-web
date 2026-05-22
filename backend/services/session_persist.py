from __future__ import annotations

from datetime import datetime
from typing import Any

from google.oauth2.credentials import Credentials
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import AuthSession, User
from services.google_auth import GOOGLE_TOKEN_URL
from services.google_token_crypto import decrypt_refresh_token
from services.session_store import UserSession


def _credentials_to_json(credentials: Credentials | None) -> dict[str, Any] | None:
    if credentials is None:
        return None
    expiry = credentials.expiry
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri or GOOGLE_TOKEN_URL,
        "client_id": credentials.client_id or settings.google_client_id,
        "client_secret": credentials.client_secret or settings.google_client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else None,
        "expiry": expiry.isoformat() if expiry else None,
    }


def _credentials_from_json(data: dict[str, Any] | None) -> Credentials | None:
    if not data:
        return None
    expiry: datetime | None = None
    raw_expiry = data.get("expiry")
    if raw_expiry:
        expiry = datetime.fromisoformat(str(raw_expiry))
        if expiry.tzinfo is not None:
            expiry = expiry.replace(tzinfo=None)
    scopes = data.get("scopes")
    return Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri") or GOOGLE_TOKEN_URL,
        client_id=data.get("client_id") or settings.google_client_id,
        client_secret=data.get("client_secret") or settings.google_client_secret,
        scopes=scopes,
        expiry=expiry,
    )


def _credentials_from_user_row(row: User) -> Credentials | None:
    rt = decrypt_refresh_token(row.google_refresh_token_encrypted)
    if not rt:
        return None
    scopes = row.google_scopes.split() if (row.google_scopes or "").strip() else None
    return Credentials(
        token=None,
        refresh_token=rt,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
    )


def _row_to_user_session(row: AuthSession, credentials: Credentials | None) -> UserSession:
    return UserSession(
        id=row.id,
        credentials=credentials,
        email=row.email,
        name=row.name,
        picture=row.picture,
        google_sub=row.google_sub,
        db_user_id=row.db_user_id,
    )


async def upsert_auth_session(
    db: AsyncSession, session_id: str, session: UserSession
) -> None:
    creds_json = _credentials_to_json(session.credentials)
    existing = await db.get(AuthSession, session_id)
    if existing is None:
        db.add(
            AuthSession(
                id=session_id,
                db_user_id=session.db_user_id,
                email=session.email,
                name=session.name,
                picture=session.picture,
                google_sub=session.google_sub,
                credentials_json=creds_json,
            )
        )
    else:
        existing.db_user_id = session.db_user_id
        existing.email = session.email
        existing.name = session.name
        existing.picture = session.picture
        existing.google_sub = session.google_sub
        existing.credentials_json = creds_json
    await db.commit()


async def fetch_auth_session(db: AsyncSession, session_id: str) -> UserSession | None:
    row = await db.get(AuthSession, session_id)
    if row is None:
        return None
    credentials = _credentials_from_json(row.credentials_json)
    if credentials is None and row.db_user_id is not None:
        user_row = await db.get(User, row.db_user_id)
        if user_row is not None:
            credentials = _credentials_from_user_row(user_row)
    return _row_to_user_session(row, credentials)


async def delete_auth_session(db: AsyncSession, session_id: str) -> None:
    await db.execute(delete(AuthSession).where(AuthSession.id == session_id))
    await db.commit()
