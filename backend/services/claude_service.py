from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic
from google.auth.credentials import Credentials

from config import settings
from services import (
    calendar_service,
    docs_service,
    drive_service,
    gmail_service,
    sheets_service,
    slides_service,
    web_search_service,
)
from services import apify_restaurant_mcp_service, mcp_gateway_service

ACTION_BLOCK = re.compile(r"<action>\s*([\s\S]*?)\s*</action>", re.IGNORECASE)


@dataclass(frozen=True)
class ReceiptDefaults:
    """Per-user defaults for receipt → Google Sheets (and optional Drive doc)."""

    spreadsheet_id: str | None
    sheet_range: str
    confirm_before_append: bool


def _receipt_system_suffix(rd: ReceiptDefaults) -> str:
    cfg = {
        "default_spreadsheet_id": rd.spreadsheet_id,
        "append_range_a1": rd.sheet_range,
        "confirm_before_append": rd.confirm_before_append,
    }
    return (
        "\n\n## Receipts & expense rows\n"
        "When the user sends a **receipt image** or asks to log an expense from a photo:\n"
        "1. Read merchant, date, total, currency, tax (if visible), and short notes from the image.\n"
        "2. **Default destination is Google Sheets.** Use `append_google_sheet_rows` with "
        "`spreadsheet_id` = default_spreadsheet_id from settings and `range_a1` = append_range_a1, "
        "unless the user explicitly asks for a **Google Doc / Drive document** instead—in that case "
        "use `create_google_doc` with title like `Receipt — {merchant} — {date}` and body = plain-text extraction.\n"
        "3. Row shape: one row with values in order: **Date (ISO)**, **Merchant**, **Total**, **Currency**, **Tax**, **Notes**.\n"
        "4. If `confirm_before_append` is true: on the **first** receipt turn, **do not** call "
        "`append_google_sheet_rows`. Show the extracted fields and the exact row you would append in a **short text** "
        "way (few lines, casual tone), and ask the user "
        "to reply **yes** / **add it** / **confirm** to proceed. After they confirm in a follow-up message, call "
        "`append_google_sheet_rows` using the same settings.\n"
        "5. If `default_spreadsheet_id` is null, ask once for a spreadsheet URL or id, or offer `create_google_sheet` "
        "(e.g. title \"Ally Receipts\") and tell them to save that id in Ally settings.\n"
        f"Receipt settings JSON: {json.dumps(cfg)}\n"
    )


def _user_message_content(
    text: str,
    image_parts: list[tuple[str, str]] | None,
) -> str | list[dict[str, Any]]:
    """Plain string, or multimodal blocks for Claude."""
    if not image_parts:
        return text
    blocks: list[dict[str, Any]] = [{"type": "text", "text": text}]
    for media_type, b64 in image_parts[:4]:
        blocks.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": b64,
                },
            }
        )
    return blocks


def _should_attach_receipt_instructions(
    text: str,
    image_parts: list[tuple[str, str]] | None,
    rd: ReceiptDefaults,
) -> bool:
    if image_parts:
        return True
    t = (text or "").strip().lower()
    if t in ("yes", "y", "ok", "confirm", "add it", "proceed", "go ahead"):
        return rd.confirm_before_append
    msg_l = (text or "").lower()
    keys = (
        "receipt",
        "expense",
        "invoice",
        "refund",
        "scan",
        "append",
        "spreadsheet",
        "log this",
        "extract",
    )
    return any(k in msg_l for k in keys)


GMAIL_TOOL_NAMES = frozenset(
    {"list_gmail_threads", "search_gmail", "get_gmail_thread"}
)


GMAIL_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_gmail_threads",
        "description": (
            "List recent Gmail threads (thread id + snippet). "
            "Optional Gmail search query: e.g. is:unread, is:inbox, from:person@x.com, subject:word."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Number of threads to return (1-30). Default 15.",
                },
                "query": {
                    "type": "string",
                    "description": "Optional Gmail search query string.",
                },
            },
        },
    },
    {
        "name": "search_gmail",
        "description": "Search Gmail using Gmail query syntax (same as Gmail search box).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Gmail search query (required), e.g. is:unread from:alice",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Max threads (1-30). Default 25.",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_gmail_thread",
        "description": (
            "Fetch one thread as plain text (headers + bodies). "
            "Use thread_id from list_gmail_threads or search_gmail."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "thread_id": {
                    "type": "string",
                    "description": "Gmail thread id",
                },
            },
            "required": ["thread_id"],
        },
    },
]

DRIVE_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_drive_files",
        "description": (
            "List recent Google Drive files (Google Docs, Sheets, Slides, PDFs) "
            "with id, name, mimeType. Optional extra Drive query fragment "
            "(e.g. name contains 'resume')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "page_size": {
                    "type": "integer",
                    "description": "Max files (1-50). Default 20.",
                },
                "query": {
                    "type": "string",
                    "description": "Optional extra AND clause for Drive q= (advanced operators).",
                },
            },
        },
    },
    {
        "name": "search_drive",
        "description": (
            "Search Drive by full-text (same idea as Drive search). "
            "Use when the user mentions a topic or filename fragment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search_term": {
                    "type": "string",
                    "description": "Words to search for in file content or metadata",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Max results (1-50). Default 25.",
                },
            },
            "required": ["search_term"],
        },
    },
    {
        "name": "get_drive_file_text",
        "description": (
            "Read plain text from a Drive file by id. Works for Google Docs (text), "
            "Sheets (CSV), Slides (plain export when available), and small text files. "
            "Use file id from list_drive_files or search_drive."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_id": {
                    "type": "string",
                    "description": "Drive file id",
                },
            },
            "required": ["file_id"],
        },
    },
]

DOCS_TOOLS: list[dict[str, Any]] = [
    {
        "name": "create_google_doc",
        "description": (
            "Create a new Google Doc in the user's Drive with a title and optional initial plain text."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Document title"},
                "initial_text": {
                    "type": "string",
                    "description": "Optional body text to insert after creation",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "append_google_doc_text",
        "description": "Append plain text to the end of an existing Google Doc (by document id).",
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string"},
                "text": {"type": "string"},
            },
            "required": ["document_id", "text"],
        },
    },
    {
        "name": "replace_google_doc_body",
        "description": (
            "Replace the entire body of a Google Doc with new plain text. "
            "Destructive—confirm intent with the user when appropriate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "string"},
                "text": {"type": "string", "description": "New full body (plain text)"},
            },
            "required": ["document_id", "text"],
        },
    },
]

SHEETS_TOOLS: list[dict[str, Any]] = [
    {
        "name": "create_google_sheet",
        "description": (
            "Create a new Google Spreadsheet with a title. "
            "Optional initial_rows: 2D array of cell values starting at Sheet1!A1."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "initial_rows": {
                    "type": "array",
                    "description": "Optional rows, each row an array of strings/numbers",
                    "items": {"type": "array"},
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "read_google_sheet_range",
        "description": "Read cell values from a spreadsheet (A1 notation, e.g. Sheet1!A1:D20).",
        "input_schema": {
            "type": "object",
            "properties": {
                "spreadsheet_id": {"type": "string"},
                "range_a1": {
                    "type": "string",
                    "description": "Default Sheet1!A1:Z500 if omitted",
                },
            },
            "required": ["spreadsheet_id"],
        },
    },
    {
        "name": "update_google_sheet_range",
        "description": "Overwrite a range with a 2D values array (USER_ENTERED).",
        "input_schema": {
            "type": "object",
            "properties": {
                "spreadsheet_id": {"type": "string"},
                "range_a1": {"type": "string"},
                "values": {
                    "type": "array",
                    "description": "2D array of new cell values",
                    "items": {"type": "array"},
                },
            },
            "required": ["spreadsheet_id", "range_a1", "values"],
        },
    },
    {
        "name": "append_google_sheet_rows",
        "description": "Append rows after the table anchored at range_a1 (usually Sheet1!A1).",
        "input_schema": {
            "type": "object",
            "properties": {
                "spreadsheet_id": {"type": "string"},
                "range_a1": {"type": "string"},
                "values": {
                    "type": "array",
                    "items": {"type": "array"},
                },
            },
            "required": ["spreadsheet_id", "values"],
        },
    },
]

SLIDES_TOOLS: list[dict[str, Any]] = [
    {
        "name": "create_google_slides",
        "description": "Create a new empty Google Slides presentation with a title; returns presentation_id and URL.",
        "input_schema": {
            "type": "object",
            "properties": {"title": {"type": "string"}},
            "required": ["title"],
        },
    },
    {
        "name": "add_google_slides_title_body_slide",
        "description": (
            "Add one slide (title + body layout) to an existing presentation. "
            "Use after create_google_slides or when user gives a presentation_id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "presentation_id": {"type": "string"},
                "slide_title": {"type": "string"},
                "slide_body": {"type": "string", "description": "Body text (plain)"},
            },
            "required": ["presentation_id", "slide_title"],
        },
    },
]

CALENDAR_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_google_calendars",
        "description": "List calendars the user has access to (id + summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "max_results": {"type": "integer", "description": "1-50, default 20"},
            },
        },
    },
    {
        "name": "list_google_calendar_events",
        "description": (
            "List upcoming/specified events. Use calendar_id primary unless user names another. "
            "Optional time_min, time_max as RFC3339 datetimes to bound the window."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "calendar_id": {"type": "string"},
                "time_min": {"type": "string"},
                "time_max": {"type": "string"},
                "max_results": {"type": "integer"},
            },
        },
    },
    {
        "name": "create_google_calendar_event",
        "description": (
            "Create a calendar event on the given calendar (default primary). "
            "start_datetime and end_datetime must be RFC3339 with offset or Z. "
            "Optional time_zone (default America/New_York) applies to those fields."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "calendar_id": {"type": "string"},
                "summary": {"type": "string"},
                "start_datetime": {"type": "string"},
                "end_datetime": {"type": "string"},
                "description": {"type": "string"},
                "time_zone": {"type": "string"},
            },
            "required": ["summary", "start_datetime", "end_datetime"],
        },
    },
    {
        "name": "update_google_calendar_event",
        "description": (
            "Patch an existing event (event_id from list_google_calendar_events). "
            "Provide any of: summary, description. To reschedule, provide BOTH "
            "start_datetime and end_datetime (RFC3339) plus optional time_zone."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "calendar_id": {"type": "string"},
                "event_id": {"type": "string"},
                "summary": {"type": "string"},
                "description": {"type": "string"},
                "start_datetime": {"type": "string"},
                "end_datetime": {"type": "string"},
                "time_zone": {"type": "string"},
            },
            "required": ["event_id"],
        },
    },
    {
        "name": "delete_google_calendar_event",
        "description": (
            "Permanently delete an event. Use event_id from list_google_calendar_events. "
            "Confirm with the user when appropriate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "calendar_id": {"type": "string"},
                "event_id": {"type": "string"},
            },
            "required": ["event_id"],
        },
    },
]

WORKSPACE_TOOLS: list[dict[str, Any]] = (
    GMAIL_TOOLS
    + DRIVE_TOOLS
    + DOCS_TOOLS
    + SHEETS_TOOLS
    + SLIDES_TOOLS
    + CALENDAR_TOOLS
)

WEB_TOOLS: list[dict[str, Any]] = [
    {
        "name": "web_search",
        "description": (
            "Search the public web for up-to-date information (hours, reservations, menus, news, prices, addresses). "
            "REQUIRED whenever the user asks for anything that could change over time or needs a link/phone for a business. "
            "Call it before answering; do not refuse or say you cannot browse the web—use this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (required)"},
                "max_results": {
                    "type": "integer",
                    "description": "Number of results (1-8). Default 5.",
                },
            },
            "required": ["query"],
        },
    }
]

MCP_TOOLS: list[dict[str, Any]] = [
    {
        "name": "mcp_call",
        "description": (
            "Call an MCP-style HTTP tool server. **Preferred for restaurants:** `server` **`apify-opentable`** "
            "(ClearPath OpenTable Booker on Apify) or **`apify-resy`** (Resy Booker). "
            "Set `APIFY_TOKEN` on the backend. OpenTable tools include `search_restaurants`, `check_availability`, "
            "`book_reservation` (paid per Apify—warn the user before calling), `my_reservations`, `cancel_reservation`, "
            "`login`, `verify_otp` — use snake_case args from the actor README (e.g. `party_size`, `query`, `city`). "
            "**Legacy self-hosted:** `server` **`opentable`** hits `MCP_GATEWAY_URL` (Railway Playwright) with tools like "
            "`opentable_search`, `opentable_availability`, `opentable_booking_link`. "
            "Always pass tool JSON the actor expects; summarize errors honestly."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "apify-opentable | apify-resy | opentable (self-hosted gateway)",
                },
                "tool": {"type": "string", "description": "Tool name to call"},
                "input": {"type": "object", "description": "Tool input JSON"},
            },
            "required": ["server", "tool", "input"],
        },
    }
]


def _tools_for_request(*, enable_google_tools: bool) -> list[dict[str, Any]]:
    return (WORKSPACE_TOOLS if enable_google_tools else []) + WEB_TOOLS + MCP_TOOLS

SYSTEM = """You are Ally — texting like a close friend on iMessage/SMS: warm, quick, a little fun, zero corporate polish. **Default length: 1–4 short lines (~60 words).** Stretch only if they clearly want depth, steps, or a list.

**Voice:** mostly lowercase (skip “Email Voice” and title case). keep normal capitals for names, brands, acronyms, URLs, times/dates, and **inside `<action>` JSON** where required. contractions ok. skip intros (“sure thing!”, “happy to help”) — start with the answer. one emoji max, optional.

You can help with:
- Google Workspace tasks (Gmail/Drive/Docs/Sheets/Slides/Calendar).
- Web questions: you MUST call `web_search` for anything time-sensitive or local (restaurants, reservations, hours, “what’s open”, news, prices). Never say you “can’t access the web” or “can’t get current results” **before** you have called `web_search` at least once. After `web_search`, summarize with real titles and URLs from the tool output. For **OpenTable / Resy reservations**, prefer **`mcp_call`** with **`server` `apify-opentable`** or **`apify-resy`**: `search_restaurants`, `check_availability`, then `book_reservation` / `my_reservations` / `cancel_reservation` as needed (warn before paid `book_reservation`). If Apify is not configured, you may try legacy `server` `opentable` (self-hosted) or fall back to `web_search` + links. If results are empty, try ONE tighter query; if still empty, say honestly results were thin.
- Finance questions (general educational guidance and calculations; not financial advice).

You have tools to:
- **Gmail**: list threads, search, read a thread as plain text. Never invent emails—use tools.
- **Drive**: list/search files, read plain text / CSV exports. Never invent file contents—use tools.
- **Google Docs**: create, append, replace body (plain text).
- **Google Sheets**: create spreadsheets, read/update/append ranges (A1 notation, 2D values arrays).
- **Google Slides**: create a presentation, add slides with title + body text.
- **Google Calendar**: list calendars, list events, create / update / delete events (event ids from list events).
- **Web search**: use `web_search` for up-to-date facts. When you use it, cite sources by including URLs in your answer.

Use the right tools whenever the user asks about data in their account or wants to create/edit content.
For Slides with multiple bullets, put them in slide_body as lines or a short list converted to text.

Finance guidance rules:
- Be clear you’re not a financial advisor.
- If giving strategy suggestions, ask for time horizon + risk tolerance if missing.
- For numbers, show assumptions and do simple math checks.

Style rules (internal — still use tools correctly):
- Sound human: short clauses, line breaks between thoughts, not one giant paragraph.
- No “as an ai…”, no lectures, no numbered essays unless they asked for steps.
- One emoji max (optional); don’t stack emojis.
- **OpenTable / Resy (Apify MCP):** Use `mcp_call` with **`server` `apify-opentable`** or **`apify-resy`**. Typical flow: `search_restaurants` → `check_availability` → optional `login` + `verify_otp` before `book_reservation`. **`book_reservation` costs money on Apify**—confirm with the user first. **`cancel_reservation`** needs a confirmation number (often from `my_reservations`). If tools error, say what happened in one line and fall back to `web_search`. **Legacy `server` `opentable`:** only if the self-hosted gateway is deployed; otherwise use Apify.

When the user clearly wants you to **send** an email through Gmail **now** (immediate, after they confirm in the app), end your reply with EXACTLY one block in this form (JSON only inside the tags, no markdown fences):
<action>
{"action":"send_email","to":"one@address.com","subject":"Subject","body":"Plain body. Use \\n for newlines inside the JSON string."}
</action>

Rules for <action> send_email:
- Only include that block if they want to send mail now (not delayed).
- "to" must be a single email address.
- "subject" and "body" must be what should be sent after the user confirms in the app.
- Do not include <action> unless sending is requested.

When the user wants an email **sent later** (e.g. "in 10 minutes", "tomorrow at 9am", "in 2 hours"), Ally **does** support server-side scheduling. Compute the target time in **UTC** and end your reply with EXACTLY one block:
<action>
{"action":"schedule_email","run_at":"2026-02-10T15:00:00Z","to":"one@address.com","subject":"Subject","body":"Plain body. Use \\n for newlines in JSON."}
</action>

Rules for <action> schedule_email:
- "run_at" MUST be RFC3339 / ISO-8601 **with timezone** (prefer ending Z for UTC). Example: 2026-02-10T15:00:00Z
- "run_at" must be at least ~15 seconds in the future from message time.
- Same rules as send_email for to/subject/body (single recipient, real content).
- Optional "thread_id" if replying in-thread.
- Do **not** tell the user that Gmail alone must schedule it—this app queues the send; a background worker must be running in production.
- If they only asked a question without agreeing to schedule, do not output schedule_email."""


def split_reply_and_action(text: str) -> tuple[str, dict[str, Any] | None]:
    m = ACTION_BLOCK.search(text)
    if not m:
        return text.strip(), None
    reply = ACTION_BLOCK.sub("", text).strip()
    raw = m.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return text.strip(), None
    if not isinstance(data, dict):
        return text.strip(), None
    act = data.get("action")
    if act in ("send_email", "schedule_email"):
        return reply, data
    return text.strip(), None


def _assistant_api_content(content: list[Any]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for b in content:
        if b.type == "text":
            blocks.append({"type": "text", "text": b.text})
        elif b.type == "tool_use":
            blocks.append(
                {
                    "type": "tool_use",
                    "id": b.id,
                    "name": b.name,
                    "input": b.input,
                }
            )
    return blocks


def _execute_workspace_tool(
    name: str,
    tool_input: dict[str, Any],
    credentials: Credentials | None,
) -> str:
    if credentials is None:
        return json.dumps({"error": "google_not_connected", "tool": name})
    if name in GMAIL_TOOL_NAMES:
        return gmail_service.execute_gmail_tool(name, tool_input, credentials)
    if name in drive_service.DRIVE_TOOL_NAMES:
        return drive_service.execute_drive_tool(name, tool_input, credentials)
    if name in docs_service.DOCS_TOOL_NAMES:
        return docs_service.execute_docs_tool(name, tool_input, credentials)
    if name in sheets_service.SHEETS_TOOL_NAMES:
        return sheets_service.execute_sheets_tool(name, tool_input, credentials)
    if name in slides_service.SLIDES_TOOL_NAMES:
        return slides_service.execute_slides_tool(name, tool_input, credentials)
    if name in calendar_service.CALENDAR_TOOL_NAMES:
        return calendar_service.execute_calendar_tool(name, tool_input, credentials)
    return json.dumps({"error": f"unknown tool: {name}"})


async def run_chat(
    user_message: str,
    history: list[dict[str, str]],
    google_credentials: Credentials | None,
    *,
    receipt_defaults: ReceiptDefaults | None = None,
    image_parts: list[tuple[str, str]] | None = None,
    enable_google_tools: bool = True,
    mcp_user_id: str | None = None,
) -> tuple[str, dict[str, Any] | None]:
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    system = SYSTEM
    if receipt_defaults is not None and _should_attach_receipt_instructions(
        user_message, image_parts, receipt_defaults
    ):
        system = SYSTEM + _receipt_system_suffix(receipt_defaults)
    messages: list[dict[str, Any]] = []
    for h in history[-30:]:
        role, content = h.get("role"), h.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": _user_message_content(user_message, image_parts),
        }
    )

    max_rounds = 24
    for _ in range(max_rounds):
        tools = _tools_for_request(
            enable_google_tools=bool(enable_google_tools and google_credentials is not None)
        )
        resp = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=8192,
            system=system,
            messages=messages,
            tools=tools,
        )

        if resp.stop_reason == "tool_use":
            messages.append(
                {"role": "assistant", "content": _assistant_api_content(resp.content)}
            )
            tool_results: list[dict[str, Any]] = []
            for block in resp.content:
                if block.type == "tool_use":
                    inp = block.input if isinstance(block.input, dict) else {}
                    if block.name == "web_search":
                        q = str(inp.get("query") or "").strip()
                        mr = inp.get("max_results")
                        try:
                            max_results = int(mr) if mr is not None else 5
                        except Exception:
                            max_results = 5
                        out = await web_search_service.web_search(
                            query=q, max_results=max_results
                        )
                    elif block.name == "mcp_call":
                        server = str(inp.get("server") or "").strip()
                        tool = str(inp.get("tool") or "").strip()
                        tool_input = inp.get("input")
                        if not isinstance(tool_input, dict):
                            tool_input = {}
                        try:
                            if server.lower() in ("apify-opentable", "apify-resy"):
                                out_obj = await apify_restaurant_mcp_service.call_actor_tool(
                                    server=server,
                                    tool=tool,
                                    arguments=tool_input,
                                )
                                out = json.dumps(out_obj)
                            else:
                                gw = (settings.mcp_gateway_url or "").strip()
                                if not gw:
                                    out = json.dumps(
                                        {
                                            "error": "mcp_unavailable",
                                            "detail": (
                                                "MCP_GATEWAY_URL is not set for self-hosted opentable, "
                                                "or use server apify-opentable / apify-resy with APIFY_TOKEN."
                                            ),
                                        }
                                    )
                                else:
                                    effective_user = (mcp_user_id or "").strip() or "ally-web-anon"
                                    out_obj = await mcp_gateway_service.mcp_call(
                                        user_id=effective_user,
                                        server=server,
                                        tool=tool,
                                        input_json=tool_input,
                                    )
                                    out = json.dumps(out_obj)
                        except apify_restaurant_mcp_service.ApifyRestaurantMcpError as e:
                            out = json.dumps({"error": "apify_mcp_failed", "detail": str(e)})
                        except Exception as e:
                            out = json.dumps({"error": "mcp_call_failed", "detail": str(e)})
                    else:
                        out = _execute_workspace_tool(block.name, inp, google_credentials)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": out,
                        }
                    )
            if not tool_results:
                break
            messages.append({"role": "user", "content": tool_results})
            continue

        parts = [b.text for b in resp.content if b.type == "text"]
        full = "".join(parts)
        return split_reply_and_action(full)

    return "I could not finish (too many tool steps). Try a narrower question.", None
