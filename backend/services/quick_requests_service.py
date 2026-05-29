from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic
from google.auth.credentials import Credentials

from config import settings
from services.llm_models import model_for_tier
from services import gmail_service

logger = logging.getLogger(__name__)

_GMAIL_QUICK_QUERY = "newer_than:7d in:inbox"
_MAX_THREADS = 100
_MAX_SUGGESTIONS = 5

_SYSTEM = """You triage Gmail thread snippets for a productivity assistant.

Return ONLY threads that clearly need the user to DO something soon, for example:
reply or follow up, approve/decline, schedule or reschedule, pay an invoice,
complete a form, RSVP, send missing information, chase a deadline someone set.

OMIT: newsletters, marketing, generic automated receipts with no reply needed,
pure FYI, social digests, login codes, no-reply noise.

Rules:
- Use ONLY thread_id values that appear in the input. Never invent ids.
- At most {_max} items. If nothing qualifies, return {{"items":[]}}.
- label: under 80 characters, imperative, specific (who/topic or date if known from snippet).
- prefill: one or two sentences the USER would send their assistant; name the action and
  any concrete detail from the snippet (person, topic, date). No vague "handle email".

Output: a single JSON object, no markdown fences, no commentary:
{{"items":[{{"thread_id":"...","label":"...","prefill":"..."}}]}}
""".format(_max=_MAX_SUGGESTIONS)


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    return t.strip()


def _parse_model_json(text: str) -> dict[str, Any]:
    raw = _strip_code_fence(text)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}\s*$", raw)
        if m:
            return json.loads(m.group(0))
        raise


async def build_actionable_quick_requests(
    credentials: Credentials,
) -> list[dict[str, str]]:
    rows = await asyncio.to_thread(
        gmail_service.list_threads_snippets_paginated,
        credentials,
        query=_GMAIL_QUICK_QUERY,
        max_threads=_MAX_THREADS,
        page_size=100,
    )
    if not rows:
        return []

    valid_ids = {r["thread_id"] for r in rows}
    lines: list[str] = []
    for i, r in enumerate(rows, start=1):
        sid = (r.get("snippet") or "").replace("\n", " ").strip()[:400]
        lines.append(f'{i}. thread_id={r["thread_id"]}\n   snippet: {sid}')
    user_block = "Threads (last 7 days, inbox):\n\n" + "\n\n".join(lines)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        resp = await client.messages.create(
            model=model_for_tier("fast"),
            max_tokens=1800,
            temperature=0.2,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_block}],
        )
    except Exception as exc:
        logger.exception("quick_requests anthropic call failed")
        raise RuntimeError("Could not rank quick requests right now.") from exc

    parts = [b.text for b in resp.content if b.type == "text"]
    full = "".join(parts).strip()
    if not full:
        return []

    try:
        data = _parse_model_json(full)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("quick_requests bad JSON from model: %s", exc)
        return []

    items_raw = data.get("items")
    if not isinstance(items_raw, list):
        return []

    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for it in items_raw:
        if not isinstance(it, dict):
            continue
        tid = str(it.get("thread_id") or "").strip()
        label = str(it.get("label") or "").strip()
        prefill = str(it.get("prefill") or "").strip()
        if tid not in valid_ids or tid in seen:
            continue
        if len(label) < 4 or len(prefill) < 12:
            continue
        tail = f"\n\nGmail thread_id: {tid}"
        max_prefill = 700
        prefill_capped = prefill[: max(12, max_prefill - len(tail))].rstrip()
        out.append(
            {
                "thread_id": tid,
                "label": label[:90],
                "prefill": prefill_capped + tail,
            }
        )
        seen.add(tid)
        if len(out) >= _MAX_SUGGESTIONS:
            break
    return out
