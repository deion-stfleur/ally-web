from __future__ import annotations

import os
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config import settings

_engine: AsyncEngine | None = None
async_session_maker: async_sessionmaker[AsyncSession] | None = None


def _normalize_postgres_scheme(url: str) -> str:
    u = url.strip()
    if u.startswith("postgres://"):
        return "postgresql://" + u[len("postgres://") :]
    return u


def _to_async_url(url: str) -> str:
    base = _normalize_postgres_scheme(url)
    if base.startswith("postgresql+asyncpg://"):
        return base
    if base.startswith("postgresql://"):
        return "postgresql+asyncpg://" + base[len("postgresql://") :]
    raise ValueError("DATABASE_URL must be a postgres URL")


def _is_local_postgres_url(url: str) -> bool:
    """Unix-socket URLs (postgresql:///db) have no hostname; treat as local."""
    u = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return True
    if not host and parsed.path.startswith("/"):
        return True
    return False


def _ssl_connect_args(url: str) -> dict:
    if _is_local_postgres_url(url):
        return {}
    return {"ssl": True}


def create_engine_if_configured() -> None:
    global _engine, async_session_maker
    # Prefer live env (after load_dotenv) over Settings snapshot at import time.
    url = os.getenv("DATABASE_URL", "").strip() or (settings.database_url or "").strip()
    if not url:
        _engine = None
        async_session_maker = None
        return
    if _engine is not None:
        return
    async_url = _to_async_url(url)
    _engine = create_async_engine(
        async_url,
        pool_pre_ping=True,
        connect_args=_ssl_connect_args(async_url),
    )
    async_session_maker = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )


async def dispose_engine() -> None:
    global _engine, async_session_maker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    async_session_maker = None
