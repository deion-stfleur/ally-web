from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import User
from deps import get_current_session, get_db
from models.schemas import OpenTableConnectRequest, OpenTableMfaRequest
from services.opentable_session_crypto import (
    decrypt_opentable_session,
    encrypt_opentable_session,
)
from services.session_store import UserSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/opentable", tags=["opentable"])


@router.get("/status")
async def opentable_status(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    if session.db_user_id is None:
        return {"connected": False}
    row = await db.get(User, session.db_user_id)
    if row is None:
        return {"connected": False}
    return {"connected": bool((row.opentable_session_encrypted or "").strip())}


@router.post("/disconnect")
async def opentable_disconnect(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    if session.db_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user.")
    row = await db.get(User, session.db_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    row.opentable_session_encrypted = None
    await db.commit()
    return {"ok": True}


@router.post("/connect")
async def opentable_connect(
    body: OpenTableConnectRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """
    Starts OpenTable connect by forwarding credentials to the MCP gateway.
    We do NOT store the password; the gateway returns a session blob.
    """
    if session.db_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user.")
    url = (settings.mcp_gateway_url or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP gateway not configured.",
        )
    import httpx

    payload = {
        "user_id": str(session.db_user_id),
        "email": body.email,
        "password": body.password,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{url.rstrip('/')}/opentable/connect", json=payload)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gateway error {resp.status_code}",
        )
    data = resp.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Invalid gateway response")

    if data.get("mfa_required") is True:
        # Gateway is holding state; client must submit MFA code.
        return {"mfa_required": True}

    blob = data.get("session_blob")
    if not isinstance(blob, str) or not blob.strip():
        raise HTTPException(status_code=502, detail="Missing session_blob")

    row = await db.get(User, session.db_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    row.opentable_session_encrypted = encrypt_opentable_session(blob)
    await db.commit()
    return {"ok": True, "mfa_required": False}


@router.post("/connect/mfa")
async def opentable_connect_mfa(
    body: OpenTableMfaRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Complete MFA and store returned session blob."""
    if session.db_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user.")
    url = (settings.mcp_gateway_url or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP gateway not configured.",
        )
    import httpx

    payload = {"user_id": str(session.db_user_id), "code": body.code}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{url.rstrip('/')}/opentable/connect/mfa", json=payload)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gateway error {resp.status_code}",
        )
    data = resp.json()
    blob = data.get("session_blob")
    if not isinstance(blob, str) or not blob.strip():
        raise HTTPException(status_code=502, detail="Missing session_blob")

    row = await db.get(User, session.db_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    row.opentable_session_encrypted = encrypt_opentable_session(blob)
    await db.commit()
    return {"ok": True}


@router.get("/session")
async def opentable_session_for_gateway(
    user_id: str,
    x_mcp_gateway_secret: str | None = Header(default=None, alias="X-MCP-Gateway-Secret"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """
    Internal endpoint for the MCP gateway to retrieve a decrypted session blob.
    Protect with MCP_GATEWAY_SECRET (sent as X-MCP-Gateway-Secret).
    """
    expected = (settings.mcp_gateway_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP gateway secret not configured.",
        )
    if (x_mcp_gateway_secret or "").strip() != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        # Validate UUID-ish without importing uuid: just look up by string cast.
        row = await db.get(User, user_id)
    except Exception:
        row = None
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    blob = decrypt_opentable_session(row.opentable_session_encrypted)
    return {"session_blob": blob or ""}

