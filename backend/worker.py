"""
Poll Postgres for due scheduled jobs and run them (e.g. delayed Gmail send).

Run locally (separate terminal from uvicorn):

  cd backend && ./venv/bin/python worker.py

Production: run as a second process / Heroku worker dyno with the same DATABASE_URL
and Google OAuth env vars as the web app.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(_BACKEND_ROOT / ".env", override=True)
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ally.worker")


async def main() -> None:
    from config import settings

    if not settings.database_url:
        raise SystemExit("DATABASE_URL is required for the worker.")

    from db import session as db_session
    from db.session import create_engine_if_configured, dispose_engine
    from services.job_runner import run_due_jobs_once

    create_engine_if_configured()
    if db_session.async_session_maker is None:
        raise SystemExit("Could not initialize the database engine.")

    logger.info("Worker started; polling for due jobs.")
    try:
        while True:
            did_work = False
            async with db_session.async_session_maker() as session:
                if await run_due_jobs_once(session):
                    did_work = True
            await asyncio.sleep(1.5 if did_work else 10.0)
    finally:
        await dispose_engine()
        logger.info("Worker stopped.")


if __name__ == "__main__":
    asyncio.run(main())
