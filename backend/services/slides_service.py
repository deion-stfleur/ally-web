from __future__ import annotations

import json
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _slides(credentials: Credentials):
    return build("slides", "v1", credentials=credentials, cache_discovery=False)


def create_presentation(credentials: Credentials, title: str) -> dict[str, str]:
    title = (title or "Untitled").strip()[:5000]
    svc = _slides(credentials)
    try:
        pres = svc.presentations().create(body={"title": title}).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    pid = pres.get("presentationId") or ""
    if not pid:
        raise RuntimeError("Slides API did not return presentationId")
    return {
        "presentation_id": pid,
        "url": f"https://docs.google.com/presentation/d/{pid}/edit",
    }


def add_title_body_slide(
    credentials: Credentials,
    presentation_id: str,
    title_text: str,
    body_text: str,
) -> dict[str, str]:
    svc = _slides(credentials)
    try:
        resp = (
            svc.presentations()
            .batchUpdate(
                presentationId=presentation_id,
                body={
                    "requests": [
                        {
                            "createSlide": {
                                "slideLayoutReference": {
                                    "predefinedLayout": "TITLE_AND_BODY"
                                }
                            }
                        }
                    ]
                },
            )
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    replies = resp.get("replies") or []
    if not replies:
        raise RuntimeError("Slides batchUpdate: no replies")
    slide_id = (replies[0].get("createSlide") or {}).get("objectId")
    if not slide_id:
        raise RuntimeError("Slides batchUpdate: missing slide id")

    try:
        pres = svc.presentations().get(presentationId=presentation_id).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc

    title_shape_id: str | None = None
    body_shape_id: str | None = None
    for page in pres.get("slides") or []:
        if page.get("objectId") != slide_id:
            continue
        for el in page.get("pageElements") or []:
            shape = el.get("shape")
            if not shape:
                continue
            ph = shape.get("placeholder") or {}
            ptype = ph.get("type")
            oid = el.get("objectId")
            if not oid:
                continue
            if ptype == "TITLE":
                title_shape_id = oid
            elif ptype in ("BODY", "SUBTITLE"):
                if body_shape_id is None or ptype == "BODY":
                    body_shape_id = oid
        break

    reqs2: list[dict[str, Any]] = []
    if title_shape_id:
        reqs2.append(
            {
                "insertText": {
                    "objectId": title_shape_id,
                    "text": (title_text or "")[:500],
                }
            }
        )
    if body_shape_id:
        reqs2.append(
            {
                "insertText": {
                    "objectId": body_shape_id,
                    "text": (body_text or "")[:8000],
                }
            }
        )
    if reqs2:
        try:
            svc.presentations().batchUpdate(
                presentationId=presentation_id, body={"requests": reqs2}
            ).execute()
        except HttpError as exc:
            raise RuntimeError(exc.reason or str(exc)) from exc

    return {
        "slide_id": slide_id,
        "url": f"https://docs.google.com/presentation/d/{presentation_id}/edit",
    }


SLIDES_TOOL_NAMES = frozenset(
    {
        "create_google_slides",
        "add_google_slides_title_body_slide",
    }
)


def execute_slides_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "create_google_slides":
            title = str(tool_input.get("title") or "Untitled").strip()
            out = create_presentation(credentials, title)
            return json.dumps(out, indent=2)[:20_000]
        if name == "add_google_slides_title_body_slide":
            pid = str(tool_input.get("presentation_id") or "").strip()
            t = str(tool_input.get("slide_title") or "")
            b = str(tool_input.get("slide_body") or "")
            if not pid:
                return json.dumps({"error": "presentation_id is required"})
            out = add_title_body_slide(credentials, pid, t, b)
            return json.dumps(out, indent=2)[:20_000]
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown slides tool: {name}"})
