from __future__ import annotations

import json
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _docs(credentials: Credentials):
    return build("docs", "v1", credentials=credentials, cache_discovery=False)


def _body_end_index(doc: dict[str, Any]) -> int:
    body = doc.get("body") or {}
    last = 1
    for el in body.get("content") or []:
        ei = el.get("endIndex")
        if isinstance(ei, int):
            last = max(last, ei)
    return last


def create_document(
    credentials: Credentials,
    title: str,
    initial_text: str = "",
) -> dict[str, str]:
    title = (title or "Untitled").strip()[:5000]
    svc = _docs(credentials)
    try:
        doc = svc.documents().create(body={"title": title}).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    did = doc.get("documentId")
    if not did:
        raise RuntimeError("Docs API did not return documentId")
    if initial_text:
        try:
            svc.documents().batchUpdate(
                documentId=did,
                body={
                    "requests": [
                        {
                            "insertText": {
                                "location": {"index": 1},
                                "text": initial_text[:500_000],
                            }
                        }
                    ]
                },
            ).execute()
        except HttpError as exc:
            raise RuntimeError(exc.reason or str(exc)) from exc
    return {
        "document_id": did,
        "url": f"https://docs.google.com/document/d/{did}/edit",
    }


def append_text(credentials: Credentials, document_id: str, text: str) -> None:
    if not text:
        return
    svc = _docs(credentials)
    try:
        doc = svc.documents().get(documentId=document_id).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    end_idx = _body_end_index(doc)
    insert_at = max(1, end_idx - 1)
    try:
        svc.documents().batchUpdate(
            documentId=document_id,
            body={
                "requests": [
                    {
                        "insertText": {
                            "location": {"index": insert_at},
                            "text": text[:500_000],
                        }
                    }
                ]
            },
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc


def replace_body_plain(credentials: Credentials, document_id: str, text: str) -> None:
    svc = _docs(credentials)
    try:
        doc = svc.documents().get(documentId=document_id).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    end_idx = _body_end_index(doc)
    requests: list[dict[str, Any]] = []
    if end_idx > 2:
        requests.append(
            {
                "deleteContentRange": {
                    "range": {"startIndex": 1, "endIndex": end_idx - 1},
                }
            }
        )
    requests.append(
        {
            "insertText": {
                "location": {"index": 1},
                "text": (text or "")[:500_000],
            }
        }
    )
    try:
        svc.documents().batchUpdate(
            documentId=document_id, body={"requests": requests}
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc


DOCS_TOOL_NAMES = frozenset(
    {
        "create_google_doc",
        "append_google_doc_text",
        "replace_google_doc_body",
    }
)


def execute_docs_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "create_google_doc":
            title = str(tool_input.get("title") or "Untitled").strip()
            body = str(tool_input.get("initial_text") or "")
            out = create_document(credentials, title=title, initial_text=body)
            return json.dumps(out, indent=2)[:50_000]
        if name == "append_google_doc_text":
            did = str(tool_input.get("document_id") or "").strip()
            text = str(tool_input.get("text") or "")
            if not did:
                return json.dumps({"error": "document_id is required"})
            append_text(credentials, did, text)
            return json.dumps(
                {
                    "ok": True,
                    "document_id": did,
                    "url": f"https://docs.google.com/document/d/{did}/edit",
                }
            )
        if name == "replace_google_doc_body":
            did = str(tool_input.get("document_id") or "").strip()
            text = str(tool_input.get("text") or "")
            if not did:
                return json.dumps({"error": "document_id is required"})
            replace_body_plain(credentials, did, text)
            return json.dumps(
                {
                    "ok": True,
                    "document_id": did,
                    "url": f"https://docs.google.com/document/d/{did}/edit",
                }
            )
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown docs tool: {name}"})
