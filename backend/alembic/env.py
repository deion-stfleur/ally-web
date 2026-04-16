from __future__ import annotations

import os
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import urlparse

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env", override=True)
load_dotenv()

from db.base import Base

# Import ORM models so metadata is populated.
import db.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _normalize_postgres_scheme(url: str) -> str:
    u = url.strip()
    if u.startswith("postgres://"):
        return "postgresql://" + u[len("postgres://") :]
    return u


def _sync_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to backend/.env (see .env.example), "
            "e.g. postgresql://USER:PASSWORD@localhost:5432/DBNAME — then run "
            "alembic again from the backend directory."
        )
    base = _normalize_postgres_scheme(raw)
    if base.startswith("postgresql+asyncpg://"):
        base = "postgresql://" + base[len("postgresql+asyncpg://") :]
    if base.startswith("postgresql+psycopg://"):
        return base
    if base.startswith("postgresql://"):
        return "postgresql+psycopg://" + base[len("postgresql://") :]
    raise RuntimeError("DATABASE_URL must be a PostgreSQL URL.")


def _is_local_postgres_url(url: str) -> bool:
    u = url.replace("postgresql+psycopg://", "postgresql://", 1)
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        return True
    if not host and parsed.path.startswith("/"):
        return True
    return False


def _sync_connect_args(url: str) -> dict:
    if _is_local_postgres_url(url):
        return {}
    return {"sslmode": "require"}


def run_migrations_offline() -> None:
    url = _sync_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = _sync_database_url()
    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args=_sync_connect_args(url),
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
