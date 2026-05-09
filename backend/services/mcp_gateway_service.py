from __future__ import annotations

import json

import httpx

from config import settings


class McpGatewayError(RuntimeError):
    pass


async def mcp_call(
    *,
    user_id: str,
    server: str,
    tool: str,
    input_json: dict,
) -> dict:
    url = (settings.mcp_gateway_url or "").strip()
    if not url:
        raise McpGatewayError("MCP_GATEWAY_URL is not configured")
    payload = {
        "user_id": user_id,
        "server": server,
        "tool": tool,
        "input": input_json,
    }
    # OpenTable availability uses Playwright and can exceed 30s on cold start.
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=15.0)) as client:
        resp = await client.post(f"{url.rstrip('/')}/tools/call", json=payload)
    if resp.status_code != 200:
        raise McpGatewayError(f"Gateway error {resp.status_code}: {resp.text[:4000]}")
    try:
        data = resp.json()
    except Exception:
        raise McpGatewayError(f"Invalid gateway JSON: {resp.text[:2000]}") from None
    if not isinstance(data, dict):
        raise McpGatewayError("Gateway returned non-object JSON")
    return data

