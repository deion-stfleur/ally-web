"""Google Places / Geocoding (P2a) — optional GOOGLE_MAPS_API_KEY."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"


class PlacesNotConfiguredError(RuntimeError):
    pass


def _api_key() -> str:
    key = (settings.google_maps_api_key or "").strip()
    if not key:
        raise PlacesNotConfiguredError(
            "GOOGLE_MAPS_API_KEY is not set. Enable Geocoding + Places API in Google Cloud."
        )
    return key


async def geocode_address(address: str) -> dict[str, Any] | None:
    addr = (address or "").strip()
    if not addr:
        return None
    params = {"address": addr, "key": _api_key()}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(GEOCODE_URL, params=params)
        r.raise_for_status()
        data = r.json()
    if data.get("status") != "OK" or not data.get("results"):
        return None
    top = data["results"][0]
    loc = top.get("geometry", {}).get("location") or {}
    return {
        "formatted_address": top.get("formatted_address"),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "place_id": top.get("place_id"),
    }


async def things_to_do_near(
    *,
    address: str,
    query: str | None = None,
    radius_meters: int = 5000,
    max_results: int = 8,
) -> dict[str, Any]:
    """Geocode address then search nearby places or text search."""
    geo = await geocode_address(address)
    if not geo or geo.get("lat") is None or geo.get("lng") is None:
        return {
            "error": "geocode_failed",
            "address": address,
            "detail": "Could not resolve that address.",
        }
    lat, lng = geo["lat"], geo["lng"]
    key = _api_key()
    cap = max(1, min(int(max_results or 8), 15))
    radius = max(500, min(int(radius_meters or 5000), 50000))

    q = (query or "").strip()
    async with httpx.AsyncClient(timeout=25.0) as client:
        if q:
            params = {
                "query": f"{q} near {geo.get('formatted_address') or address}",
                "key": key,
            }
            r = await client.get(TEXT_SEARCH_URL, params=params)
        else:
            params = {
                "location": f"{lat},{lng}",
                "radius": radius,
                "key": key,
            }
            r = await client.get(NEARBY_URL, params=params)
        r.raise_for_status()
        data = r.json()

    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        return {
            "error": "places_search_failed",
            "status": status,
            "detail": data.get("error_message") or status,
            "center": geo,
        }

    items: list[dict[str, Any]] = []
    for p in (data.get("results") or [])[:cap]:
        place_id = p.get("place_id")
        maps_url = (
            f"https://www.google.com/maps/place/?q=place_id:{place_id}"
            if place_id
            else None
        )
        items.append(
            {
                "name": p.get("name"),
                "address": p.get("formatted_address") or p.get("vicinity"),
                "rating": p.get("rating"),
                "types": (p.get("types") or [])[:4],
                "maps_url": maps_url,
                "open_now": (p.get("opening_hours") or {}).get("open_now"),
            }
        )

    return {
        "center": geo,
        "query": q or "things to do nearby",
        "radius_meters": radius,
        "results": items,
        "count": len(items),
    }
