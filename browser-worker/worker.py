"""
Poll Postgres for browser_task jobs and run Browser Use.

Deploy on Railway with the same DATABASE_URL as Heroku plus:
  ANTHROPIC_API_KEY, ALLY_INTERNAL_SECRET, BACKEND_PUBLIC_URL
  BROWSER_WORKER_MAX_CONCURRENT (default 4)
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from runner import run_browser_task

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ally.browser_worker")

JOB_BROWSER_TASK = "browser_task"
_semaphore: asyncio.Semaphore | None = None


def _database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        raise SystemExit("DATABASE_URL is required")
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://") and "+asyncpg" not in raw:
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw


def _max_concurrent() -> int:
    try:
        return max(1, min(12, int(os.getenv("BROWSER_WORKER_MAX_CONCURRENT", "4"))))
    except ValueError:
        return 4


async def _claim_job(session: AsyncSession) -> uuid.UUID | None:
    now = datetime.now(timezone.utc)
    row = await session.execute(
        text(
            """
WITH cte AS (
    SELECT id FROM scheduled_jobs
    WHERE status = 'pending' AND run_at <= :now AND job_type = :jt
    ORDER BY run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE scheduled_jobs AS j
SET status = 'processing', updated_at = NOW(), attempts = j.attempts + 1
FROM cte
WHERE j.id = cte.id
RETURNING j.id
"""
        ),
        {"now": now, "jt": JOB_BROWSER_TASK},
    )
    rid = row.scalar_one_or_none()
    return uuid.UUID(str(rid)) if rid else None


async def _load_job(session: AsyncSession, job_id: uuid.UUID) -> dict | None:
    row = await session.execute(
        text("SELECT payload_json FROM scheduled_jobs WHERE id = :id AND job_type = :jt"),
        {"id": job_id, "jt": JOB_BROWSER_TASK},
    )
    raw = row.scalar_one_or_none()
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    import json

    return json.loads(str(raw))


async def _notify_backend(
    *,
    job_id: uuid.UUID,
    status: str,
    result_text: str | None,
    error: str | None,
) -> None:
    base = (os.getenv("BACKEND_PUBLIC_URL") or "").strip().rstrip("/")
    secret = (os.getenv("ALLY_INTERNAL_SECRET") or "").strip()
    if not base or not secret:
        raise RuntimeError("BACKEND_PUBLIC_URL and ALLY_INTERNAL_SECRET required")

    url = f"{base}/api/internal/browser-jobs/complete"
    payload = {
        "job_id": str(job_id),
        "status": status,
        "result_text": result_text,
        "error": error,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"X-Ally-Internal-Secret": secret},
        )
        resp.raise_for_status()


async def _process_job(session_factory: async_sessionmaker, job_id: uuid.UUID) -> None:
    global _semaphore
    assert _semaphore is not None
    async with _semaphore:
        async with session_factory() as session:
            payload = await _load_job(session, job_id)
        if not payload:
            logger.error("job %s missing payload", job_id)
            return

        task = str(payload.get("task") or "").strip()
        start_url = payload.get("start_url")
        max_steps = max(5, min(80, int(os.getenv("BROWSER_WORKER_MAX_STEPS", "25"))))
        timeout_s = max(60, min(900, int(os.getenv("BROWSER_TASK_TIMEOUT_SECONDS", "600"))))

        status, text = await run_browser_task(
            task=task,
            start_url=str(start_url).strip() if start_url else None,
            max_steps=max_steps,
            timeout_seconds=timeout_s,
        )
        err = text if status == "failed" else None
        result = text if status == "completed" else None

        try:
            await _notify_backend(
                job_id=job_id,
                status=status,
                result_text=result,
                error=err,
            )
            logger.info("job %s %s", job_id, status)
        except Exception:
            logger.exception("backend notify failed job=%s", job_id)
            async with session_factory() as session:
                await session.execute(
                    text(
                        """
                        UPDATE scheduled_jobs
                        SET status = 'failed', last_error = :err, updated_at = NOW()
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": job_id,
                        "err": "backend callback failed"[:8000],
                    },
                )
                await session.commit()


async def main() -> None:
    global _semaphore
    n = _max_concurrent()
    _semaphore = asyncio.Semaphore(n)
    engine = create_async_engine(_database_url(), pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    logger.info("Browser worker started (max_concurrent=%s)", n)

    try:
        while True:
            job_id: uuid.UUID | None = None
            async with session_factory() as session:
                async with session.begin():
                    job_id = await _claim_job(session)
            if job_id is None:
                await asyncio.sleep(3.0)
                continue
            asyncio.create_task(_process_job(session_factory, job_id))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
