from __future__ import annotations

import io
import json
from typing import Any

from google.auth.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload


def _drive(credentials: Credentials):
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _escape_drive_q(term: str) -> str:
    return term.replace("\\", "\\\\").replace("'", "\\'")


# Docs, Sheets, Slides, PDF — common workspace files (resume often PDF or Doc).
_DEFAULT_FILES_Q = (
    "trashed = false and ("
    "mimeType = 'application/vnd.google-apps.document' or "
    "mimeType = 'application/vnd.google-apps.spreadsheet' or "
    "mimeType = 'application/vnd.google-apps.presentation' or "
    "mimeType = 'application/pdf' or "
    "mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
    ")"
)


def list_workspace_files(
    credentials: Credentials,
    page_size: int = 20,
    extra_query: str = "",
) -> list[dict[str, str | None]]:
    page_size = max(1, min(int(page_size or 20), 50))
    q = _DEFAULT_FILES_Q
    extra = (extra_query or "").strip()
    if extra:
        q = f"{q} and ({extra})"
    svc = _drive(credentials)
    try:
        resp = (
            svc.files()
            .list(
                q=q,
                pageSize=page_size,
                fields="files(id,name,mimeType,modifiedTime)",
                orderBy="modifiedTime desc",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    out: list[dict[str, str | None]] = []
    for f in resp.get("files") or []:
        out.append(
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "mimeType": f.get("mimeType"),
                "modifiedTime": f.get("modifiedTime"),
            }
        )
    return out


def search_workspace_files(
    credentials: Credentials,
    search_term: str,
    max_results: int = 25,
) -> list[dict[str, str | None]]:
    term = _escape_drive_q(search_term.strip())
    if not term:
        return []
    max_results = max(1, min(int(max_results or 25), 50))
    q = f"trashed = false and fullText contains '{term}'"
    svc = _drive(credentials)
    try:
        resp = (
            svc.files()
            .list(
                q=q,
                pageSize=max_results,
                fields="files(id,name,mimeType,modifiedTime)",
                orderBy="modifiedTime desc",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    out: list[dict[str, str | None]] = []
    for f in resp.get("files") or []:
        out.append(
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "mimeType": f.get("mimeType"),
                "modifiedTime": f.get("modifiedTime"),
            }
        )
    return out


def _export_text(svc, file_id: str, export_mime: str) -> str:
    request = svc.files().export_media(fileId=file_id, mimeType=export_mime)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue().decode("utf-8", errors="replace")


def _download_media_text(svc, file_id: str, max_bytes: int = 5_000_000) -> str:
    request = svc.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if buf.tell() > max_bytes:
            return buf.getvalue()[:max_bytes].decode("utf-8", errors="replace") + "\n...[truncated binary]"
    raw = buf.getvalue()
    if not raw:
        return ""
    try:
        return raw.decode("utf-8", errors="replace")
    except Exception:
        return "[Binary file: open in Google Drive to view.]"


def get_file_plain_text(
    credentials: Credentials,
    file_id: str,
    max_chars: int = 100_000,
) -> str:
    svc = _drive(credentials)
    try:
        meta = (
            svc.files()
            .get(fileId=file_id, fields="id,name,mimeType,size")
            .execute()
        )
    except HttpError as exc:
        raise RuntimeError(exc.reason or str(exc)) from exc
    mime = meta.get("mimeType") or ""
    name = meta.get("name") or file_id
    text = ""

    if mime == "application/vnd.google-apps.document":
        text = _export_text(svc, file_id, "text/plain")
    elif mime == "application/vnd.google-apps.spreadsheet":
        text = _export_text(svc, file_id, "text/csv")
    elif mime == "application/vnd.google-apps.presentation":
        try:
            text = _export_text(svc, file_id, "text/plain")
        except Exception:
            text = "[Google Slides: could not export as plain text. Open in Drive.]"
    elif mime.startswith("text/"):
        text = _download_media_text(svc, file_id)
    elif mime == "application/pdf":
        text = (
            "[PDF file — text extraction is not implemented here. "
            "Open it in Google Drive or convert to Google Docs to read contents in chat.]"
        )
    elif (
        mime
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        text = (
            "[Word .docx — open in Google Drive or convert to Google Docs "
            "to read full text in chat.]"
        )
    else:
        text = (
            f"[File “{name}” has mime type {mime}. "
            "Export to text is not supported for this type in Ally; open in Drive.]"
        )

    text = text.strip()
    if len(text) > max_chars:
        text = text[:max_chars] + "\n...[truncated]"
    return text


def execute_drive_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials,
) -> str:
    try:
        if name == "list_drive_files":
            page = int(tool_input.get("page_size") or 20)
            q = str(tool_input.get("query") or "").strip()
            data = list_workspace_files(credentials, page_size=page, extra_query=q)
            return json.dumps({"files": data}, indent=2)[:120_000]
        if name == "search_drive":
            term = str(tool_input.get("search_term") or "").strip()
            if not term:
                return json.dumps({"error": "search_term is required"})
            m = int(tool_input.get("max_results") or 25)
            data = search_workspace_files(credentials, term, max_results=m)
            return json.dumps({"files": data}, indent=2)[:120_000]
        if name == "get_drive_file_text":
            fid = str(tool_input.get("file_id") or "").strip()
            if not fid:
                return json.dumps({"error": "file_id is required"})
            text = get_file_plain_text(credentials, fid)
            return json.dumps(
                {"file_id": fid, "text": text},
                ensure_ascii=False,
            )[:120_000]
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown drive tool: {name}"})


DRIVE_TOOL_NAMES = frozenset(
    {"list_drive_files", "search_drive", "get_drive_file_text"}
)
