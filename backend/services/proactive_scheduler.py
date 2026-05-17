from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _proactive_job() -> None:
    from db import session as db_session

    if db_session.async_session_maker is None:
        logger.warning("proactive scheduler: database not configured")
        return
    from services.proactive_messaging_service import run_proactive_tick

    async with db_session.async_session_maker() as session:
        async with session.begin():
            n = await run_proactive_tick(session)
        if n:
            logger.info("proactive scheduler: sent %s message(s)", n)


def start_proactive_scheduler() -> AsyncIOScheduler:
    """Start APScheduler (30-minute proactive tick). Idempotent."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _proactive_job,
        trigger="interval",
        minutes=30,
        id="ally_proactive_sms",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    _scheduler = sched
    logger.info("proactive APScheduler started (every 30 minutes)")
    return sched


def stop_proactive_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("proactive APScheduler stopped")
