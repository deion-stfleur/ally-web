"""Run one Browser Use agent task for Ally."""

from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

ALLY_BROWSER_SYSTEM = """You are Ally's browser agent. The user is on SMS (Ally Pro).

Rules for your final answer to the user:
- lowercase, plain text, no markdown lists or bullets
- max ~450 characters unless they asked for detail
- at most one short URL if essential
- never claim you completed a purchase or booking unless you truly did on screen
- if login or captcha blocks you, say so briefly
"""


def _build_task_prompt(task: str, start_url: str | None) -> str:
    parts = [ALLY_BROWSER_SYSTEM, "", "USER TASK:", task.strip()]
    if start_url:
        parts.extend(["", f"Start at: {start_url.strip()}"])
    return "\n".join(parts)


def _extract_result(history: object) -> str:
    if history is None:
        return ""
    for attr in ("final_result", "final_message", "extracted_content"):
        val = getattr(history, attr, None)
        if val is not None:
            s = str(val).strip()
            if s:
                return s[:8000]
    return str(history).strip()[:8000] or "done"


async def run_browser_task(
    *,
    task: str,
    start_url: str | None = None,
    max_steps: int = 25,
    timeout_seconds: int = 600,
) -> tuple[str, str | None]:
    """
    Returns (status, text) where status is 'completed' or 'failed'.
    """
    from browser_use import Agent, Browser, ChatAnthropic

    model = (
        os.getenv("ANTHROPIC_MODEL")
        or os.getenv("ANTHROPIC_MODEL_HEAVY")
        or "claude-sonnet-4-20250514"
    ).strip()
    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not api_key:
        return "failed", "ANTHROPIC_API_KEY missing on browser worker"

    llm = ChatAnthropic(model=model, temperature=0.0)
    browser = Browser(headless=True)
    agent = Agent(
        task=_build_task_prompt(task, start_url),
        llm=llm,
        browser=browser,
        max_steps=max_steps,
    )

    try:
        history = await asyncio.wait_for(agent.run(), timeout=timeout_seconds)
        text = _extract_result(history)
        return "completed", text or "finished — no summary text"
    except asyncio.TimeoutError:
        return "failed", "browser task timed out"
    except Exception as exc:
        logger.exception("browser_use agent failed")
        return "failed", str(exc)[:2000]
    finally:
        try:
            await browser.close()
        except Exception:
            logger.debug("browser close failed", exc_info=True)
