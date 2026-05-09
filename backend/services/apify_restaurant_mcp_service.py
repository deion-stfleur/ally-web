"""Call Apify-hosted restaurant MCP actors (OpenTable Booker, Resy Booker) over Streamable HTTP."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from mcp import ClientSession, types as mcp_types
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client

from config import settings

logger = logging.getLogger(__name__)

# Standby MCP endpoints (Bearer = Apify API token from console).
DEFAULT_APIFY_OPENTABLE_MCP = "https://clearpath--opentable-booker.apify.actor/mcp"
DEFAULT_APIFY_RESY_MCP = "https://clearpath--resy-booker.apify.actor/mcp"


class ApifyRestaurantMcpError(RuntimeError):
    pass


def _flatten_exceptions(exc: BaseException) -> list[BaseException]:
    if isinstance(exc, BaseExceptionGroup):
        out: list[BaseException] = []
        for sub in exc.exceptions:
            out.extend(_flatten_exceptions(sub))
        return out
    return [exc]


def _mcp_url_for_server(server: str) -> str:
    s = server.strip().lower()
    if s == "apify-opentable":
        return (settings.apify_opentable_mcp_url or DEFAULT_APIFY_OPENTABLE_MCP).strip()
    if s == "apify-resy":
        return (settings.apify_resy_mcp_url or DEFAULT_APIFY_RESY_MCP).strip()
    raise ApifyRestaurantMcpError(f"Unknown Apify restaurant server: {server!r}")


def _serialize_call_tool_result(result: mcp_types.CallToolResult) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = []
    for c in result.content:
        if c.type == "text":
            blocks.append({"type": "text", "text": c.text})
        else:
            blocks.append({"type": c.type})
    out: dict[str, Any] = {"isError": bool(result.isError), "content": blocks}
    if result.structured_content is not None:
        out["structured"] = result.structured_content
    # Flatten first JSON text blob for easier LLM consumption when present.
    for b in blocks:
        if b.get("type") == "text" and isinstance(b.get("text"), str):
            raw = b["text"].strip()
            if raw.startswith("{") or raw.startswith("["):
                try:
                    out["parsed"] = json.loads(raw)
                except json.JSONDecodeError:
                    pass
            break
    return out


async def call_actor_tool(*, server: str, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """
    Run one tool on the Apify actor MCP (OpenTable or Resy).

    OpenTable actor tools (typical): search_restaurants, check_availability, book_reservation,
    my_reservations, cancel_reservation, login, verify_otp
    """
    token = (settings.apify_token or "").strip()
    if not token:
        raise ApifyRestaurantMcpError(
            "APIFY_TOKEN is not set. Add your Apify API token (Console → Settings → Integrations)."
        )
    if not tool:
        raise ApifyRestaurantMcpError("tool name is required")

    url = _mcp_url_for_server(server)
    headers = {"Authorization": f"Bearer {token}"}
    timeout = httpx.Timeout(60.0, read=300.0)

    try:
        async with create_mcp_http_client(headers, timeout) as http_client:
            async with streamable_http_client(url, http_client=http_client) as streams:
                # mcp>=1.9 yields (read_stream, write_stream, get_session_id_callback)
                read_stream, write_stream, _session_id_fn = streams
                async with ClientSession(
                    read_stream,
                    write_stream,
                    client_info=mcp_types.Implementation(name="ally-backend", version="1.0.0"),
                ) as session:
                    await session.initialize()
                    result = await session.call_tool(
                        tool,
                        arguments or {},
                        read_timeout_seconds=240.0,
                    )
                    return _serialize_call_tool_result(result)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise ApifyRestaurantMcpError(
                "Apify returned 401 — verify APIFY_TOKEN in Heroku matches "
                "https://console.apify.com/settings/integrations (no extra quotes or spaces)."
            ) from e
        raise ApifyRestaurantMcpError(
            f"Apify HTTP {e.response.status_code}: {(e.response.text or '')[:500]}"
        ) from e
    except BaseException as e:
        for sub in _flatten_exceptions(e):
            if isinstance(sub, httpx.HTTPStatusError):
                if sub.response.status_code == 401:
                    raise ApifyRestaurantMcpError(
                        "Apify returned 401 — verify APIFY_TOKEN (Console → Integrations)."
                    ) from sub
                raise ApifyRestaurantMcpError(
                    f"Apify HTTP {sub.response.status_code}: {(sub.response.text or '')[:500]}"
                ) from sub
        logger.exception("Apify MCP failure server=%s tool=%s", server, tool)
        raise ApifyRestaurantMcpError("; ".join(str(s) for s in _flatten_exceptions(e))[:2000]) from e
