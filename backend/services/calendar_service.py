from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _calendar(credentials: Credentials):
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def list_calendars(credentials: Credentials, max_results: int = 20) -> list[dict[str, str]]:
    max_results = max(1, min(int(max_results or 20), 50))
    svc = _calendar(credentials)
    try:
        resp = (
            svc.calendarList()
            .list(maxResults=max_results, showDeleted=False, showHidden=False)
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    out: list[dict[str, str]] = []
    for it in resp.get("items") or []:
        cid = it.get("id")
        if not cid:
            continue
        out.append(
            {
                "id": cid,
                "summary": it.get("summary") or cid,
                "primary": str(it.get("primary", False)),
            }
        )
    return out


def list_events(
    credentials: Credentials,
    calendar_id: str = "primary",
    time_min: str | None = None,
    time_max: str | None = None,
    max_results: int = 25,
) -> list[dict[str, Any]]:
    max_results = max(1, min(int(max_results or 25), 100))
    svc = _calendar(credentials)
    kwargs: dict[str, Any] = {
        "calendarId": calendar_id or "primary",
        "maxResults": max_results,
        "singleEvents": True,
        "orderBy": "startTime",
    }
    if time_min:
        kwargs["timeMin"] = time_min
    else:
        kwargs["timeMin"] = (
            datetime.now(timezone.utc) - timedelta(days=1)
        ).isoformat().replace("+00:00", "Z")
    if time_max:
        kwargs["timeMax"] = time_max
    try:
        resp = svc.events().list(**kwargs).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    events: list[dict[str, Any]] = []
    for ev in resp.get("items") or []:
        start = ev.get("start") or {}
        end = ev.get("end") or {}
        events.append(
            {
                "id": ev.get("id"),
                "summary": ev.get("summary", ""),
                "start": start.get("dateTime") or start.get("date"),
                "end": end.get("dateTime") or end.get("date"),
                "htmlLink": ev.get("htmlLink"),
                "hangoutLink": ev.get("hangoutLink"),
                "conferenceData": ev.get("conferenceData"),
                "description": ev.get("description"),
                "location": ev.get("location"),
            }
        )
    return events


def meeting_url_from_event(ev: dict[str, Any]) -> str | None:
    hangout = (ev.get("hangoutLink") or "").strip()
    if hangout:
        return hangout
    conf = ev.get("conferenceData") or {}
    for ep in conf.get("entryPoints") or []:
        if not isinstance(ep, dict):
            continue
        if ep.get("entryPointType") == "video" and ep.get("uri"):
            return str(ep["uri"]).strip()
    blob = f"{ev.get('description') or ''} {ev.get('location') or ''}"
    from services.meeting_baas_service import extract_meeting_urls

    urls = extract_meeting_urls(blob)
    return urls[0] if urls else None


def list_events_with_meeting_links(
    credentials: Credentials,
    calendar_id: str = "primary",
    time_min: str | None = None,
    time_max: str | None = None,
    max_results: int = 25,
) -> list[dict[str, Any]]:
    """Calendar events that include a Meet/Zoom/Teams link."""
    out: list[dict[str, Any]] = []
    for ev in list_events(
        credentials,
        calendar_id=calendar_id,
        time_min=time_min,
        time_max=time_max,
        max_results=max_results,
    ):
        url = meeting_url_from_event(ev)
        if not url:
            continue
        row = dict(ev)
        row["meeting_url"] = url
        out.append(row)
    return out


def create_event(
    credentials: Credentials,
    calendar_id: str,
    summary: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    time_zone: str = "America/New_York",
) -> dict[str, str]:
    svc = _calendar(credentials)
    body: dict[str, Any] = {
        "summary": (summary or "Event")[:1000],
        "description": (description or "")[:8000],
        "start": {"dateTime": start_datetime, "timeZone": time_zone},
        "end": {"dateTime": end_datetime, "timeZone": time_zone},
    }
    try:
        created = (
            svc.events()
            .insert(calendarId=calendar_id or "primary", body=body)
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    return {
        "event_id": created.get("id") or "",
        "htmlLink": created.get("htmlLink") or "",
    }


def patch_event(
    credentials: Credentials,
    calendar_id: str,
    event_id: str,
    summary: str | None = None,
    description: str | None = None,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    time_zone: str = "America/New_York",
) -> dict[str, str]:
    if not event_id.strip():
        raise RuntimeError("event_id is required")
    body: dict[str, Any] = {}
    if summary is not None:
        body["summary"] = str(summary)[:1000]
    if description is not None:
        body["description"] = str(description)[:8000]
    if start_datetime or end_datetime:
        if not (start_datetime and end_datetime):
            raise RuntimeError(
                "When changing time, provide both start_datetime and end_datetime (RFC3339)"
            )
        body["start"] = {"dateTime": start_datetime, "timeZone": time_zone}
        body["end"] = {"dateTime": end_datetime, "timeZone": time_zone}
    if not body:
        raise RuntimeError("Provide at least one of: summary, description, start+end times")
    svc = _calendar(credentials)
    try:
        updated = (
            svc.events()
            .patch(
                calendarId=calendar_id or "primary",
                eventId=event_id.strip(),
                body=body,
            )
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    return {
        "event_id": updated.get("id") or event_id,
        "htmlLink": updated.get("htmlLink") or "",
    }


def delete_event(
    credentials: Credentials,
    calendar_id: str,
    event_id: str,
) -> None:
    if not event_id.strip():
        raise RuntimeError("event_id is required")
    svc = _calendar(credentials)
    try:
        svc.events().delete(
            calendarId=calendar_id or "primary",
            eventId=event_id.strip(),
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc


CALENDAR_TOOL_NAMES = frozenset(
    {
        "list_google_calendars",
        "list_google_calendar_events",
        "create_google_calendar_event",
        "update_google_calendar_event",
        "delete_google_calendar_event",
    }
)


def execute_calendar_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "list_google_calendars":
            m = int(tool_input.get("max_results") or 20)
            data = list_calendars(credentials, max_results=m)
            return json.dumps({"calendars": data}, indent=2)[:50_000]
        if name == "list_google_calendar_events":
            cal = str(tool_input.get("calendar_id") or "primary").strip()
            tmin = tool_input.get("time_min")
            tmax = tool_input.get("time_max")
            m = int(tool_input.get("max_results") or 25)
            events = list_events(
                credentials,
                calendar_id=cal,
                time_min=str(tmin) if tmin else None,
                time_max=str(tmax) if tmax else None,
                max_results=m,
            )
            return json.dumps({"events": events}, indent=2)[:120_000]
        if name == "create_google_calendar_event":
            cal = str(tool_input.get("calendar_id") or "primary").strip()
            summary = str(tool_input.get("summary") or "Event")
            start = str(tool_input.get("start_datetime") or "").strip()
            end = str(tool_input.get("end_datetime") or "").strip()
            desc = str(tool_input.get("description") or "")
            tz = str(tool_input.get("time_zone") or "America/New_York")
            if not start or not end:
                return json.dumps({"error": "start_datetime and end_datetime are required (RFC3339)"})
            out = create_event(
                credentials,
                cal,
                summary,
                start,
                end,
                description=desc,
                time_zone=tz,
            )
            return json.dumps(out, indent=2)[:20_000]
        if name == "update_google_calendar_event":
            cal = str(tool_input.get("calendar_id") or "primary").strip()
            eid = str(tool_input.get("event_id") or "").strip()
            if not eid:
                return json.dumps({"error": "event_id is required"})
            summ = tool_input.get("summary")
            desc = tool_input.get("description")
            start = tool_input.get("start_datetime")
            end = tool_input.get("end_datetime")
            tz = str(tool_input.get("time_zone") or "America/New_York")
            out = patch_event(
                credentials,
                cal,
                eid,
                summary=str(summ) if summ is not None else None,
                description=str(desc) if desc is not None else None,
                start_datetime=str(start).strip() if start else None,
                end_datetime=str(end).strip() if end else None,
                time_zone=tz,
            )
            return json.dumps(out, indent=2)[:20_000]
        if name == "delete_google_calendar_event":
            cal = str(tool_input.get("calendar_id") or "primary").strip()
            eid = str(tool_input.get("event_id") or "").strip()
            if not eid:
                return json.dumps({"error": "event_id is required"})
            delete_event(credentials, cal, eid)
            return json.dumps({"ok": True, "deleted_event_id": eid})
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown calendar tool: {name}"})
