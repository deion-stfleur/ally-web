from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleAuthRequest
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db import session as db_session
from db.session import create_engine_if_configured
from services.session_store import UserSession, get_session

security = HTTPBearer(auto_error=False)


def _refresh_google_if_needed(session: UserSession) -> None:
    c = session.credentials
    if not c.expired:
        return
    if c.refresh_token:
        try:
            c.refresh(GoogleAuthRequest())
        except RefreshError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token refresh failed; sign in again.",
            ) from exc
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Google session expired; sign in again.",
    )


async def get_current_session(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> UserSession:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    session_id = payload.get("sub")
    if not session_id or not isinstance(session_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found",
        )
    _refresh_google_if_needed(session)
    return session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    create_engine_if_configured()
    # Read db_session.async_session_maker — never `from db.session import` it at module
    # level or you keep a stale reference to the initial None after the engine is created.
    if db_session.async_session_maker is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    async with db_session.async_session_maker() as session:
        yield session


async def get_db_optional() -> AsyncGenerator[AsyncSession | None, None]:
    """Yields a DB session when DATABASE_URL is set; otherwise a single None."""
    create_engine_if_configured()
    if db_session.async_session_maker is None:
        yield None
        return
    async with db_session.async_session_maker() as session:
        yield session
