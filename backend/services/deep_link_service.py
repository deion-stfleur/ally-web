"""Deep-link helpers for flights, movies, and generic search (P1 — no paid APIs)."""

from __future__ import annotations

import re
from datetime import date
from urllib.parse import quote_plus


def _clean(s: str | None) -> str:
    return (s or "").strip()


def _iso_date(s: str | None) -> str | None:
    raw = _clean(s)
    if not raw:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    return None


def google_flights_search_url(
    *,
    origin: str | None = None,
    destination: str | None = None,
    depart_date: str | None = None,
    return_date: str | None = None,
    adults: int = 1,
) -> str:
    """Google Flights search URL (user completes booking on Google)."""
    o = _clean(origin)
    d = _clean(destination)
    dep = _iso_date(depart_date)
    ret = _iso_date(return_date)
    parts: list[str] = ["Flights"]
    if o and d:
        parts.append(f"from {o} to {d}")
    elif d:
        parts.append(f"to {d}")
    elif o:
        parts.append(f"from {o}")
    if dep:
        parts.append(f"on {dep}")
    if ret:
        parts.append(f"return {ret}")
    if adults and adults != 1:
        parts.append(f"{adults} adults")
    q = " ".join(parts)
    return f"https://www.google.com/travel/flights?q={quote_plus(q)}"


def kayak_flights_search_url(
    *,
    origin: str | None = None,
    destination: str | None = None,
    depart_date: str | None = None,
    return_date: str | None = None,
) -> str:
    o = _clean(origin)
    d = _clean(destination)
    dep = _iso_date(depart_date) or ""
    ret = _iso_date(return_date) or ""
    if o and d and dep:
        path = f"{quote_plus(o)}-{quote_plus(d)}/{dep}"
        if ret:
            path += f"/{ret}"
        return f"https://www.kayak.com/flights/{path}"
    q = " ".join(x for x in (o, d, dep) if x)
    return f"https://www.kayak.com/flights/{quote_plus(q)}" if q else "https://www.kayak.com/flights/"


def movie_showtimes_url(
    *,
    movie_title: str | None = None,
    location: str | None = None,
    date_str: str | None = None,
) -> dict[str, str]:
    """Fandango + Google Movies style links (no seat API)."""
    title = _clean(movie_title)
    loc = _clean(location)
    when = _iso_date(date_str)
    fandango_q = " ".join(x for x in (title, loc) if x)
    fandango = (
        f"https://www.fandango.com/search/?q={quote_plus(fandango_q)}"
        if fandango_q
        else "https://www.fandango.com/"
    )
    google_parts = ["movie showtimes"]
    if title:
        google_parts.append(title)
    if loc:
        google_parts.append(f"near {loc}")
    if when:
        google_parts.append(when)
    google_movies = f"https://www.google.com/search?q={quote_plus(' '.join(google_parts))}"
    return {
        "fandango_url": fandango,
        "google_showtimes_url": google_movies,
        "primary_url": fandango if title else google_movies,
    }


def build_flight_links_payload(
    *,
    origin: str | None = None,
    destination: str | None = None,
    depart_date: str | None = None,
    return_date: str | None = None,
    adults: int = 1,
) -> dict[str, object]:
    google = google_flights_search_url(
        origin=origin,
        destination=destination,
        depart_date=depart_date,
        return_date=return_date,
        adults=adults,
    )
    kayak = kayak_flights_search_url(
        origin=origin,
        destination=destination,
        depart_date=depart_date,
        return_date=return_date,
    )
    return {
        "primary_url": google,
        "google_flights_url": google,
        "kayak_url": kayak,
        "note": "User completes booking on the linked site; Ally does not purchase tickets.",
    }


def build_movie_links_payload(
    *,
    movie_title: str | None = None,
    location: str | None = None,
    date_str: str | None = None,
) -> dict[str, object]:
    links = movie_showtimes_url(movie_title=movie_title, location=location, date_str=date_str)
    return {
        **links,
        "note": "Showtimes and seats vary; user books on the linked site.",
    }


def today_iso() -> str:
    return date.today().isoformat()
