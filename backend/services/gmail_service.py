from __future__ import annotations

import base64
import json
from email.message import EmailMessage
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _gmail(credentials: Credentials):
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def _decode_b64url(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def extract_plain_from_payload(payload: dict[str, Any]) -> str:
    if not payload:
        return ""
    mime_type = (payload.get("mimeType") or "").lower()
    body = payload.get("body") or {}
    data = body.get("data")
    if data:
        if mime_type.startswith("text/plain"):
            try:
                return _decode_b64url(data)
            except Exception:
                return ""
        return ""
    texts: list[str] = []
    for part in payload.get("parts") or []:
        t = extract_plain_from_payload(part)
        if t:
            texts.append(t)
    return "\n".join(texts).strip()


def message_plain_text(msg: dict[str, Any]) -> str:
    pl = msg.get("payload") or {}
    headers = {h["name"].lower(): h["value"] for h in pl.get("headers", [])}
    subj = headers.get("subject", "")
    from_ = headers.get("from", "")
    date = headers.get("date", "")
    body = extract_plain_from_payload(pl)
    return f"From: {from_}\nDate: {date}\nSubject: {subj}\n\n{body}".strip()


def list_threads_summary(
    credentials: Credentials,
    max_results: int = 15,
    query: str = "",
) -> list[dict[str, str]]:
    max_results = max(1, min(int(max_results or 15), 30))
    svc = _gmail(credentials)
    kwargs: dict[str, Any] = {"userId": "me", "maxResults": max_results}
    if query and query.strip():
        kwargs["q"] = query.strip()
    try:
        res = svc.users().threads().list(**kwargs).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    out: list[dict[str, str]] = []
    for th in res.get("threads") or []:
        tid = th.get("id")
        if not tid:
            continue
        out.append(
            {
                "thread_id": tid,
                "snippet": (th.get("snippet") or "")[:500],
            }
        )
    return out


def list_threads_snippets_paginated(
    credentials: Credentials,
    *,
    query: str,
    max_threads: int = 100,
    page_size: int = 100,
) -> list[dict[str, str]]:
    """List thread id + snippet until max_threads or Gmail has no more pages.

    Gmail allows up to 500 threads per ``threads().list`` call; we default to
    100 per page and paginate with ``nextPageToken`` when more rows are needed.
    """
    max_threads = max(1, min(int(max_threads), 100))
    page_size = max(1, min(int(page_size), 500))
    svc = _gmail(credentials)
    out: list[dict[str, str]] = []
    page_token: str | None = None
    q = query.strip()
    while len(out) < max_threads:
        batch = min(page_size, max_threads - len(out))
        kwargs: dict[str, Any] = {"userId": "me", "maxResults": batch}
        if q:
            kwargs["q"] = q
        if page_token:
            kwargs["pageToken"] = page_token
        try:
            res = svc.users().threads().list(**kwargs).execute()
        except HttpError as exc:
            raise RuntimeError(exc.reason or str(exc)) from exc
        for th in res.get("threads") or []:
            tid = th.get("id")
            if not tid:
                continue
            out.append(
                {
                    "thread_id": tid,
                    "snippet": (th.get("snippet") or "")[:500],
                }
            )
            if len(out) >= max_threads:
                return out
        page_token = res.get("nextPageToken")
        if not page_token:
            break
    return out


def get_thread_plain_text(
    credentials: Credentials,
    thread_id: str,
    max_chars: int = 80000,
) -> str:
    svc = _gmail(credentials)
    try:
        t = (
            svc.users()
            .threads()
            .get(userId="me", id=thread_id, format="full")
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    chunks: list[str] = []
    for m in t.get("messages") or []:
        chunks.append(message_plain_text(m))
        chunks.append("---")
    out = "\n".join(chunks).strip()
    if len(out) > max_chars:
        out = out[:max_chars] + "\n...[truncated]"
    return out


def send_email(
    credentials: Credentials,
    to: str,
    subject: str,
    body: str,
    thread_id: str | None = None,
) -> dict[str, str | None]:
    msg = EmailMessage()
    msg["To"] = to.strip()
    msg["Subject"] = subject
    msg.set_content(body)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    svc = _gmail(credentials)
    send_body: dict[str, str] = {"raw": raw}
    if thread_id:
        send_body["threadId"] = thread_id
    try:
        sent = svc.users().messages().send(userId="me", body=send_body).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    return {
        "message_id": sent.get("id"),
        "thread_id": sent.get("threadId"),
    }


def execute_gmail_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "list_gmail_threads":
            m = int(tool_input.get("max_results") or 15)
            q = str(tool_input.get("query") or "").strip()
            data = list_threads_summary(credentials, max_results=m, query=q)
            return json.dumps({"threads": data}, indent=2)[:120_000]
        if name == "search_gmail":
            q = str(tool_input.get("query") or "").strip()
            if not q:
                return json.dumps({"error": "query is required"})
            m = int(tool_input.get("max_results") or 25)
            data = list_threads_summary(credentials, max_results=m, query=q)
            return json.dumps({"threads": data}, indent=2)[:120_000]
        if name == "get_gmail_thread":
            tid = str(tool_input.get("thread_id") or "").strip()
            if not tid:
                return json.dumps({"error": "thread_id is required"})
            text = get_thread_plain_text(credentials, tid)
            return text[:120_000]
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown tool: {name}"})
