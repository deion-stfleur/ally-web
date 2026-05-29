"""
Poll Postgres for due scheduled jobs and run them (delayed Gmail send, background agent + SMS).

Run locally (separate terminal from uvicorn):

  cd backend && ./venv/bin/python worker.py

Production: run as a second process / Heroku worker dyno with the same DATABASE_URL
and Google OAuth env vars as the web app.
"""

from __future__ import annotations

import asyncio
import logging
import time
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
    from services.meeting_baas_service import reconcile_stale_meeting_jobs
    from services.meeting_calendar_auto_join_service import tick_calendar_auto_join
    from services.watch_rules_service import enqueue_due_watch_rules

    create_engine_if_configured()
    if db_session.async_session_maker is None:
        raise SystemExit("Could not initialize the database engine.")

    from services.proactive_messaging_service import run_proactive_tick

    logger.info("Worker started; polling for due jobs.")
    last_proactive_at = 0.0
    last_meeting_reconcile_at = 0.0
    proactive_interval_s = 30 * 60
    meeting_reconcile_interval_s = 5 * 60
    try:
        while True:
            did_work = False
            async with db_session.async_session_maker() as session:
                if await run_due_jobs_once(session):
                    did_work = True
            async with db_session.async_session_maker() as session:
                async with session.begin():
                    n = await enqueue_due_watch_rules(session)
                    cj = await tick_calendar_auto_join(session)
            if n:
                did_work = True
            if cj:
                did_work = True
                logger.info("Worker calendar auto-join dispatched %s bot(s)", cj)
            now = time.monotonic()
            if now - last_meeting_reconcile_at >= meeting_reconcile_interval_s:
                last_meeting_reconcile_at = now
                async with db_session.async_session_maker() as session:
                    async with session.begin():
                        mr = await reconcile_stale_meeting_jobs(session)
                if mr:
                    did_work = True
                    logger.info("Worker reconciled %s meeting note job(s)", mr)
            now = time.monotonic()
            if now - last_proactive_at >= proactive_interval_s:
                last_proactive_at = now
                async with db_session.async_session_maker() as session:
                    async with session.begin():
                        sent = await run_proactive_tick(session)
                    if sent:
                        did_work = True
                        logger.info("Worker proactive tick sent %s message(s)", sent)
            await asyncio.sleep(1.5 if did_work else 10.0)
    finally:
        await dispose_engine()
        logger.info("Worker stopped.")


if __name__ == "__main__":
    asyncio.run(main())
