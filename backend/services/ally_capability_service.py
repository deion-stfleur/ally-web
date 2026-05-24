"""Ally capability tools: places, deep links, vibe-coding sites."""

from __future__ import annotations

import json
import logging
from typing import Any

from services import deep_link_service, places_service, site_service
from services.site_service import SiteServiceError, SiteToolContext

logger = logging.getLogger(__name__)

ALLY_TOOL_NAMES = frozenset(
    {
        "things_to_do_near",
        "build_flight_search_link",
        "build_movie_search_link",
        "create_ally_site",
        "write_site_files",
        "read_site_file",
        "list_site_files",
        "publish_ally_site",
    }
)


async def execute_ally_tool(
    name: str,
    tool_input: dict[str, Any],
    *,
    site_ctx: SiteToolContext | None = None,
) -> str:
    inp = tool_input if isinstance(tool_input, dict) else {}
    try:
        if name == "things_to_do_near":
            out = await places_service.things_to_do_near(
                address=str(inp.get("address") or ""),
                query=inp.get("query"),
                radius_meters=int(inp.get("radius_meters") or 5000),
                max_results=int(inp.get("max_results") or 8),
            )
            return json.dumps(out)
        if name == "build_flight_search_link":
            out = deep_link_service.build_flight_links_payload(
                origin=inp.get("origin"),
                destination=inp.get("destination"),
                depart_date=inp.get("depart_date"),
                return_date=inp.get("return_date"),
                adults=int(inp.get("adults") or 1),
            )
            return json.dumps(out)
        if name == "build_movie_search_link":
            out = deep_link_service.build_movie_links_payload(
                movie_title=inp.get("movie_title"),
                location=inp.get("location"),
                date_str=inp.get("date_str"),
            )
            return json.dumps(out)

        if site_ctx is None:
            return json.dumps(
                {
                    "error": "site_tools_unavailable",
                    "detail": "Site tools require a signed-in user session.",
                }
            )

        if name == "create_ally_site":
            files = inp.get("files")
            if not isinstance(files, list) or not files:
                html = inp.get("html") or inp.get("index_html")
                if html:
                    files = [{"path": "index.html", "content": str(html)}]
                else:
                    return json.dumps(
                        {
                            "error": "missing_files",
                            "detail": (
                                "Pass files: [{path, content}] with custom HTML/CSS/JS "
                                "(vibe coding). Minimum index.html."
                            ),
                        }
                    )
            out = await site_service.create_site_project(
                site_ctx,
                slug=str(inp.get("slug") or "") or None,
                title=str(inp.get("title") or "Ally site"),
                files=files,
                design_tokens=inp.get("design_tokens")
                if isinstance(inp.get("design_tokens"), dict)
                else None,
                version_note=inp.get("version_note"),
                publish=bool(inp.get("publish")),
            )
            return json.dumps(out)

        if name == "write_site_files":
            out = await site_service.write_site_files(
                site_ctx,
                slug=str(inp.get("slug") or ""),
                files=inp.get("files") or [],
                version_note=inp.get("version_note"),
            )
            return json.dumps(out)

        if name == "read_site_file":
            out = await site_service.read_site_file(
                site_ctx,
                slug=str(inp.get("slug") or ""),
                path=str(inp.get("path") or "index.html"),
                use_published=bool(inp.get("use_published")),
            )
            return json.dumps(out)

        if name == "list_site_files":
            out = await site_service.list_site_files(
                site_ctx,
                slug=str(inp.get("slug") or ""),
                use_published=bool(inp.get("use_published")),
            )
            return json.dumps(out)

        if name == "publish_ally_site":
            out = await site_service.publish_site_project(
                site_ctx, slug=str(inp.get("slug") or "")
            )
            return json.dumps(out)

        return json.dumps({"error": f"unknown_ally_tool: {name}"})
    except SiteServiceError as e:
        return json.dumps({"error": "site_error", "detail": str(e)})
    except places_service.PlacesNotConfiguredError as e:
        return json.dumps({"error": "places_not_configured", "detail": str(e)})
    except Exception as e:
        logger.exception("ally tool %s failed", name)
        return json.dumps({"error": "ally_tool_failed", "tool": name, "detail": str(e)})
