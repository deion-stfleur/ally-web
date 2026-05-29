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
)
from services import ally_capability_service, apify_restaurant_mcp_service, mcp_gateway_service

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

NATIVE_WEB_SEARCH_TOOL: dict[str, Any] = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 5,
}

ALLY_CAPABILITY_TOOLS: list[dict[str, Any]] = [
    {
        "name": "things_to_do_near",
        "description": (
            "Find activities and places near a street address (Google Places). "
            "Returns name, rating, and Google Maps links. Use when the user shares a location "
            "and wants things to do, eat, or visit nearby."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Street address, neighborhood, or city"},
                "query": {
                    "type": "string",
                    "description": "Optional focus: museums, coffee, parks, nightlife, etc.",
                },
                "radius_meters": {"type": "integer"},
                "max_results": {"type": "integer"},
            },
            "required": ["address"],
        },
    },
    {
        "name": "build_flight_search_link",
        "description": (
            "Build Google Flights / Kayak search URLs from origin, destination, and dates. "
            "Does not book tickets — user completes on the linked site. Use for flight requests "
            "instead of guessing fares."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string", "description": "Airport code or city"},
                "destination": {"type": "string"},
                "depart_date": {"type": "string", "description": "YYYY-MM-DD"},
                "return_date": {"type": "string", "description": "YYYY-MM-DD optional"},
                "adults": {"type": "integer"},
            },
        },
    },
    {
        "name": "build_movie_search_link",
        "description": (
            "Build Fandango / Google showtimes links for a movie near a location. "
            "Does not reserve seats — user books on the linked site."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "movie_title": {"type": "string"},
                "location": {"type": "string", "description": "City, ZIP, or neighborhood"},
                "date_str": {"type": "string", "description": "YYYY-MM-DD optional"},
            },
        },
    },
    {
        "name": "create_ally_site",
        "description": (
            "Create a vibe-coded multi-file site (custom HTML/CSS/JS). Pass `files`: "
            "[{path, content}] with at least index.html. Use design_tokens for colors/fonts. "
            "Returns preview_url (draft) and optional public_url if publish=true. "
            "For large builds use background_task first, then this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "slug": {"type": "string"},
                "files": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                    },
                },
                "html": {
                    "type": "string",
                    "description": "Shorthand: single index.html body if files omitted",
                },
                "design_tokens": {
                    "type": "object",
                    "description": "e.g. accent, font, vibe keywords for future edits",
                },
                "version_note": {"type": "string"},
                "publish": {
                    "type": "boolean",
                    "description": "If true, live at public_url immediately",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "write_site_files",
        "description": (
            "Update an existing site project (merges into draft, new version). Pass changed files only "
            "or full set. Use after user asks to tweak vibe/layout/copy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {"type": "string"},
                "files": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                    },
                },
                "version_note": {"type": "string"},
            },
            "required": ["slug", "files"],
        },
    },
    {
        "name": "read_site_file",
        "description": "Read one file from the user's site draft or published version.",
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {"type": "string"},
                "path": {"type": "string"},
                "use_published": {"type": "boolean"},
            },
            "required": ["slug", "path"],
        },
    },
    {
        "name": "list_site_files",
        "description": "List file paths in a site project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {"type": "string"},
                "use_published": {"type": "boolean"},
            },
            "required": ["slug"],
        },
    },
    {
        "name": "publish_ally_site",
        "description": (
            "Make the current draft the live public site. Tell user the public_url after."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        },
    },
    {
        "name": "join_meeting_for_notes",
        "description": (
            "Send Ally Notes bot to a Google Meet / Zoom / Teams URL. User gets an SMS summary "
            "when the meeting ends. Use when they share a meeting link and want notes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "meeting_url": {"type": "string"},
            },
            "required": ["meeting_url"],
        },
    },
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
    workspace = WORKSPACE_TOOLS if enable_google_tools else []
    return workspace + [NATIVE_WEB_SEARCH_TOOL] + ALLY_CAPABILITY_TOOLS + MCP_TOOLS

SYSTEM = """you are ally — the user's smart friend on sms/imessage, not a corporate assistant.

voice & personality (strict for every user-facing reply):
- always write in lowercase. keep normal capitals only for names, brands, acronyms, urls, times/dates, and inside <action> json where required.
- text like a smart friend texting back: warm, direct, human. use contractions and natural sentence flow.
- get to the answer fast. no preamble ("great question!", "sure!", "happy to help!", "let me check").
- never start a reply with the word "i" (rewrite: "looks rainy in boston" not "i think it's rainy").
- keep replies short unless they explicitly ask for detail, steps, a list, or a full draft.
- one emoji max, optional.
- closing line: unless they already said what they're doing today or what they need help with, end with: "any plans or anything you need me to do today?"

sms formatting (strict — plain sms only):
- never use bullet points, dashes as list markers, asterisks, headers, numbered lists, or markdown of any kind (no **bold**, no ###, no code fences in user-facing text).
- write in short plain-text sentences or short paragraphs.
- if listing multiple things, weave them into a sentence: "you've got a meeting at 2, dentist at 5, and dinner at 7"
- max 3 sentences per reply unless they ask for more detail.
- aim under ~320 characters before any <action> block when possible.

web search (strict):
- use web_search for anything time-sensitive or that needs current info (weather, news, hours, prices, sports, restaurants, "what's open", etc.). never say you can't access the web before searching.
- when you use web_search, always use the results to give a direct answer. never respond with a list of websites for the user to check.
- if search results have enough info, answer it. if you need more detail, use web_search again with a tighter query.
- the user should never know a search happened — they just get the answer. don't say "i searched", "according to my search", or "key findings".
- don't dump urls unless one short link is genuinely helpful; never a link list.
- for live sports: use tight queries (team + date + scoreboard). if results are thin after a retry, say honestly you couldn't confirm the score.

you can help with:
- google workspace (gmail, drive, docs, sheets, slides, calendar) when connected.
- web questions via web_search (see rules above).
- finance questions (general educational guidance and calculations; not financial advice).

tools (use them — never invent account data):
- gmail: list threads, search, read a thread as plain text.
- drive: list/search files, read plain text or csv exports.
- google docs: create, append, replace body (plain text).
- google sheets: create spreadsheets, read/update/append ranges (a1 notation).
- google slides: create a presentation, add slides with title + body text.
- google calendar: list calendars, list events, create / update / delete events (event ids from list events).
- opentable / resy: prefer mcp_call with server apify-opentable or apify-resy (search_restaurants, check_availability, book_reservation / my_reservations / cancel_reservation). warn before paid book_reservation. legacy server opentable only if self-hosted gateway is deployed; otherwise apify or web_search.

use the right tools whenever the user asks about data in their account or wants to create/edit content.
for slides with multiple points, put them in slide_body as plain lines.

finance guidance:
- be clear you're not a financial advisor.
- if giving strategy suggestions, ask for time horizon + risk tolerance if missing.
- for numbers, show assumptions and do simple math checks.

after any tool use, the user-facing sms reply stays short — no raw json, no long excerpts, no markdown.

proactive update preferences:
- if they say when they want texts (e.g. "text me sports updates every morning", "evening only", "don't text me before noon"), acknowledge briefly in your reply — the app saves preferred_update_time from their words.

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
- If they only asked a question without agreeing to schedule, do not output schedule_email.

When the user wants a **multi-step research or workspace task** run in the **background** (they get an **SMS when it finishes** if they have a verified phone on file; otherwise results still appear in this chat), end with EXACTLY one block:
<action>
{"action":"background_task","instruction":"One string: full task for the background agent — goals, constraints, what to deliver. Include search terms, dates, or file hints if relevant."}
</action>

Rules for background_task:
- Use when the work may need **many tool calls** (deep `web_search`, Gmail/Drive reads, etc.). **Do not** use for quick one-shot answers.
- Keep your normal reply **before** the block very short (e.g. queued — texting you when done).
- Do not put a `background_task` inside `instruction` that queues more background work.
- Do not use `background_task` for **paid** Apify `book_reservation` or **sending** email unless the user already clearly confirmed in-thread.

**SMS watches (daily or instant push):** If the user wants to be **texted updates** about a topic:
1. Confirm **what** to track (one short `spec` string).
2. **Daily** (default): ask what **time of day** (local). Default **09:00** **America/New_York** if omitted.
3. **Instant push:** if they want to be texted **as soon as something changes** (scores, news, prices, etc.), use `"mode":"instant"` — polls about every 15 minutes; only texts when something meaningful changed.
4. When they agree, end with EXACTLY one block:
<action>
{"action":"register_watch","spec":"Plain-language watch description","time_local":"09:00","timezone":"America/New_York","mode":"daily"}
</action>
For instant push use `"mode":"instant"` (optional `"poll_interval_minutes":15`). They need a **verified phone** for SMS.

**Calendar meeting auto-join (opt-in only):** Only if the user **explicitly asks** to auto-join calendar meetings for notes (e.g. "auto join my meetings", "join my calendar meetings automatically"). Requires Google connected. End with:
<action>
{"action":"enable_meeting_auto_join"}
</action>
To turn off: `{"action":"disable_meeting_auto_join"}`. Never enable without clear user consent in the thread.

**Browser automation (Ally Pro only):** When the user clearly needs you to **use a real website** (check a page, compare listings, fill a form on a site) and links/APIs are not enough:
- Only queue if they are on **Ally Pro** (the app enforces this). If they are not Pro, say browser site checks are Pro-only and point to pricing — do **not** output `browser_task`.
- Prefer `build_flight_search_link`, `mcp_call`, `things_to_do_near`, and `web_search` first when those suffice.
- When Pro and a real browser is needed, end with EXACTLY one block:
<action>
{"action":"browser_task","task":"One clear instruction for the browser agent","start_url":"https://optional-start-page"}
</action>
`start_url` is optional. Keep your reply before the block short (e.g. checking the site — texting you when done). Do not use `browser_task` for quick facts, email, or calendar."""

ALLY_CAPABILITIES_SUFFIX = """

## Travel, dining, movies, and local (P1/P2)
- **Flights:** call `build_flight_search_link` with origin, destination, and ISO dates when known; otherwise `web_search` then the link tool. Never invent prices or seat counts. Send **one** booking link (usually `primary_url`).
- **Movies:** call `build_movie_search_link` with title + location; or `web_search` for showtimes. One ticket link max; user books on Fandango/Google.
- **Restaurants (OpenTable/Resy):** after `mcp_call` search/availability, **always** include the official `booking_url` / reservation link from tool JSON in your reply. If only search results, send the best official booking link. Never claim a table is held unless the tool confirms a booking.
- **Things to do near an address:** call `things_to_do_near` with the user's address; summarize top picks with **one** maps or venue link if helpful.

## Vibe-coded websites (multi-file)
- **Create:** `create_ally_site` with custom `files` (index.html + styles.css + optional script.js). Write real HTML/CSS — distinctive typography, layout, motion — not generic boilerplate. Store vibe in `design_tokens` (accent, fonts, mood).
- **Iterate:** user asks to change look/copy → `read_site_file` / `list_site_files` then `write_site_files` with updated paths (new version each time).
- **Preview vs live:** default is **draft** — share `preview_url` in SMS. When they approve, `publish_ally_site` → share `public_url`.
- **Big builds:** queue `background_task` ("build site: …") then run site tools inside that job; text preview link when done.
- Relative asset paths only (e.g. styles.css, not absolute CDN unless needed). Max ~32 files per version.

## Sports / games (research & opinion only — strict)
- You may discuss matchups, player form, injuries, and trends using `web_search`.
- **Never** quote betting odds, lines, spreads, over/under, or implied probability from sportsbooks.
- **Never** link to sportsbooks or promote gambling.
- Frame takes as **your opinion from research**, not financial advice: "if you're watching the game, player X's usage stands out because…"
- Always add briefly: entertainment only, 21+ where applicable, gamble responsibly (1-800-GAMBLER in the US).

## Meeting notes bot (Meeting BaaS)
- When user shares a **Google Meet / Zoom / Teams** link and wants notes, call `join_meeting_for_notes` with `meeting_url`.
- Tell them ally notes is joining and they'll get a **text when the call ends**.
- Admit the bot from the waiting room when prompted.
- **Calendar auto-join:** only after they opted in via `enable_meeting_auto_join` (or equivalent text). Then Ally joins **calendar** video meetings automatically ~2 min before start — no need to paste the link each time. They can say "stop auto join meetings" to disable.

## Browser site automation (Ally Pro only)
- Use `browser_task` only when the user needs a **live website** checked (inventory, form, multi-page flow) and you already confirmed they want that depth.
- Not for flights/movies/restaurants when a link tool or MCP booking URL is enough.
- The Railway browser worker runs the task; user gets an SMS when done.

## SMS link discipline (strict)
- At most **one** short URL per SMS unless the user asked for multiple and you keep each on its own line without a list format.
- Prefer tool `primary_url` or `url` fields over pasting long URLs.
- Do not send a link farm; pick the single best next step (book, maps, or site).
"""


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
    if act in (
        "send_email",
        "schedule_email",
        "background_task",
        "register_watch",
        "enable_meeting_auto_join",
        "disable_meeting_auto_join",
        "browser_task",
    ):
        return reply, data
    return text.strip(), None


def _assistant_api_content(content: list[Any]) -> list[dict[str, Any]]:
    """Serialize assistant content for the next API turn (client tools + server web search)."""
    blocks: list[dict[str, Any]] = []
    for b in content:
        if hasattr(b, "model_dump"):
            blocks.append(b.model_dump())
            continue
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
        elif b.type == "server_tool_use":
            blocks.append(
                {
                    "type": "server_tool_use",
                    "id": b.id,
                    "name": b.name,
                    "input": b.input,
                }
            )
        elif b.type == "web_search_tool_result":
            blocks.append(
                {
                    "type": "web_search_tool_result",
                    "tool_use_id": b.tool_use_id,
                    "content": b.content,
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
    site_ctx: Any | None = None,
    meeting_ctx: Any | None = None,
    model_tier: str = "fast",
) -> tuple[str, dict[str, Any] | None]:
    from services.llm_models import model_for_tier

    tier = "heavy" if model_tier == "heavy" else "fast"
    chat_model = model_for_tier(tier)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    system = SYSTEM + ALLY_CAPABILITIES_SUFFIX
    if receipt_defaults is not None and _should_attach_receipt_instructions(
        user_message, image_parts, receipt_defaults
    ):
        system = system + _receipt_system_suffix(receipt_defaults)
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
            model=chat_model,
            max_tokens=8192,
            system=system,
            messages=messages,
            tools=tools,
        )

        if resp.stop_reason == "pause_turn":
            messages.append(
                {"role": "assistant", "content": _assistant_api_content(resp.content)}
            )
            continue

        if resp.stop_reason == "tool_use":
            messages.append(
                {"role": "assistant", "content": _assistant_api_content(resp.content)}
            )
            tool_results: list[dict[str, Any]] = []
            for block in resp.content:
                if block.type == "tool_use":
                    inp = block.input if isinstance(block.input, dict) else {}
                    if block.name == "mcp_call":
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
                    elif block.name in ally_capability_service.ALLY_TOOL_NAMES:
                        mc = meeting_ctx if isinstance(meeting_ctx, dict) else {}
                        out = await ally_capability_service.execute_ally_tool(
                            block.name,
                            inp,
                            site_ctx=site_ctx,
                            meeting_user_id=mc.get("user_id"),
                            meeting_db=mc.get("db"),
                        )
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

    return "couldn't finish (too many tool steps). try a narrower question.", None
