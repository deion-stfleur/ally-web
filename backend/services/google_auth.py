from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from google.oauth2.credentials import Credentials

from config import settings


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


async def exchange_authorization_code(
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise ValueError(f"Google token exchange failed: {detail}")
    return resp.json()


async def fetch_google_userinfo(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    resp.raise_for_status()
    return resp.json()


def credentials_from_token_response(data: dict[str, Any]) -> Credentials:
    scope_str = data.get("scope") or ""
    scopes = scope_str.split() if scope_str else None
    expires_in = int(data.get("expires_in", 0) or 0)
    # google-auth compares expiry with naive UTC; offset-aware values raise TypeError.
    expiry: datetime | None = None
    if expires_in > 0:
        expiry = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).replace(
            tzinfo=None
        )
    return Credentials(
        token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=scopes,
        expiry=expiry,
    )
