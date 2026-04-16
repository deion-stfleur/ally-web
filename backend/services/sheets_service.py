from __future__ import annotations

import json
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def _sheets(credentials: Credentials):
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def create_spreadsheet(credentials: Credentials, title: str) -> dict[str, str]:
    title = (title or "Untitled").strip()[:5000]
    svc = _sheets(credentials)
    try:
        result = svc.spreadsheets().create(
            body={"properties": {"title": title}},
            fields="spreadsheetId,properties.title",
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    sid = result.get("spreadsheetId") or ""
    if not sid:
        raise RuntimeError("Sheets API did not return spreadsheetId")
    return {
        "spreadsheet_id": sid,
        "url": f"https://docs.google.com/spreadsheets/d/{sid}/edit",
    }


def read_range(
    credentials: Credentials,
    spreadsheet_id: str,
    range_a1: str,
) -> list[list[Any]]:
    svc = _sheets(credentials)
    try:
        result = (
            svc.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_a1)
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    return result.get("values") or []


def update_range(
    credentials: Credentials,
    spreadsheet_id: str,
    range_a1: str,
    values: list[list[Any]],
) -> None:
    svc = _sheets(credentials)
    try:
        svc.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_a1,
            valueInputOption="USER_ENTERED",
            body={"values": values},
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc


def append_rows(
    credentials: Credentials,
    spreadsheet_id: str,
    range_a1: str,
    values: list[list[Any]],
) -> None:
    svc = _sheets(credentials)
    try:
        svc.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=range_a1,
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": values},
        ).execute()
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc


SHEETS_TOOL_NAMES = frozenset(
    {
        "create_google_sheet",
        "read_google_sheet_range",
        "update_google_sheet_range",
        "append_google_sheet_rows",
    }
)


def execute_sheets_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "create_google_sheet":
            title = str(tool_input.get("title") or "Untitled").strip()
            out = create_spreadsheet(credentials, title)
            rows = tool_input.get("initial_rows")
            if isinstance(rows, list) and rows:
                update_range(
                    credentials,
                    out["spreadsheet_id"],
                    "Sheet1!A1",
                    rows,
                )
            return json.dumps(out, indent=2)[:80_000]
        if name == "read_google_sheet_range":
            sid = str(tool_input.get("spreadsheet_id") or "").strip()
            r = str(tool_input.get("range_a1") or "Sheet1!A1:Z1000").strip()
            if not sid:
                return json.dumps({"error": "spreadsheet_id is required"})
            data = read_range(credentials, sid, r)
            return json.dumps({"values": data}, indent=2)[:120_000]
        if name == "update_google_sheet_range":
            sid = str(tool_input.get("spreadsheet_id") or "").strip()
            r = str(tool_input.get("range_a1") or "").strip()
            rows = tool_input.get("values")
            if not sid or not r:
                return json.dumps({"error": "spreadsheet_id and range_a1 are required"})
            if not isinstance(rows, list):
                return json.dumps({"error": "values must be a 2D array"})
            update_range(credentials, sid, r, rows)
            return json.dumps(
                {"ok": True, "spreadsheet_id": sid, "url": f"https://docs.google.com/spreadsheets/d/{sid}/edit"}
            )
        if name == "append_google_sheet_rows":
            sid = str(tool_input.get("spreadsheet_id") or "").strip()
            r = str(tool_input.get("range_a1") or "Sheet1!A1").strip()
            rows = tool_input.get("values")
            if not sid:
                return json.dumps({"error": "spreadsheet_id is required"})
            if not isinstance(rows, list):
                return json.dumps({"error": "values must be a 2D array"})
            append_rows(credentials, sid, r, rows)
            return json.dumps(
                {"ok": True, "spreadsheet_id": sid, "url": f"https://docs.google.com/spreadsheets/d/{sid}/edit"}
            )
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown sheets tool: {name}"})
