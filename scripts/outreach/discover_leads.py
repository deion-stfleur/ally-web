#!/usr/bin/env python3
"""
Discover local businesses for Ally outreach via Google Places API.

Finds name, address, website, phone → CSV compatible with generate-emails.mjs.
Optional: scrape public mailto links from websites, or Hunter.io if HUNTER_API_KEY is set.

Usage (from repo root):
  python scripts/outreach/discover_leads.py
  python scripts/outreach/discover_leads.py --city "Boston, MA" --limit 15
  python scripts/outreach/discover_leads.py --enrich scripts/outreach/discovered-leads.csv
  python scripts/outreach/discover_leads.py --sync  # merge discovered → outreach-leads.json

Requires GOOGLE_MAPS_API_KEY (Places API (New) enabled in Google Cloud Console).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")

TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
SEARCH_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.websiteUri,places.nationalPhoneNumber"
)
DETAILS_FIELD_MASK = "displayName,formattedAddress,websiteUri,nationalPhoneNumber"
HUNTER_DOMAIN_URL = "https://api.hunter.io/v2/domain-search"

CSV_FIELDS = [
    "slug",
    "businessName",
    "contactName",
    "contactTitle",
    "vertical",
    "city",
    "neighborhood",
    "email",
    "phone",
    "website",
    "teamSize",
    "emailSource",
    "needsReview",
    "placeId",
]

DEFAULT_QUERIES: list[tuple[str, str]] = [
    ("law firm", "legal"),
    ("dental office", "dental"),
    ("real estate agency", "real_estate"),
    ("accounting firm", "accounting"),
    ("financial advisor office", "accounting"),
]

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)
SKIP_EMAIL_PREFIXES = ("noreply", "no-reply", "donotreply", "mailer-daemon", "postmaster")
SKIP_EMAIL_SUFFIXES = (".png", ".jpg", ".gif", ".webp", ".svg")
SKIP_EMAIL_DOMAINS = ("domain.com", "example.com", "sentry.io", "sentry.wixpress.com", "wixpress.com")


def _api_key() -> str:
    import os

    key = (os.getenv("GOOGLE_MAPS_API_KEY") or "").strip()
    if not key:
        print(
            "Missing GOOGLE_MAPS_API_KEY in backend/.env or env\n"
            "Enable Places API (New) in Google Cloud Console.",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def slugify(name: str, seen: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:48]
    if not base:
        base = "business"
    slug = base
    n = 2
    while slug in seen:
        slug = f"{base}-{n}"
        n += 1
    seen.add(slug)
    return slug


def parse_neighborhood(address: str) -> str:
    """Best-effort Boston neighborhood from formatted address."""
    if not address:
        return ""
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        return parts[-3] if len(parts) >= 3 else parts[0]
    return ""


def is_plausible_email(email: str) -> bool:
    e = (email or "").strip().lower()
    if not e or "@" not in e:
        return False
    local = e.split("@", 1)[0]
    if any(local.startswith(p) for p in SKIP_EMAIL_PREFIXES):
        return False
    if any(e.endswith(s) for s in SKIP_EMAIL_SUFFIXES):
        return False
    domain = e.split("@", 1)[1]
    if domain in SKIP_EMAIL_DOMAINS or any(d in domain for d in ("sentry.", "wixpress.")):
        return False
    return True


def pick_best_email(candidates: list[str]) -> str | None:
    scored: list[tuple[int, str]] = []
    for raw in candidates:
        e = raw.strip()
        if not is_plausible_email(e):
            continue
        local = e.split("@", 1)[0].lower()
        score = 0
        if local in ("info", "contact", "hello", "office", "admin", "support"):
            score = 10
        elif local in ("team", "reception", "appointments"):
            score = 8
        else:
            score = 5
        scored.append((score, e))
    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored[0][1]


def fetch_emails_from_html(html: str) -> list[str]:
    found: list[str] = []
    for m in re.finditer(r"mailto:([^\"'?\s>]+)", html, re.I):
        found.append(m.group(1).split("?")[0])
    for m in EMAIL_RE.finditer(html):
        found.append(m.group(0))
    return found


def hunter_domain_search(domain: str, api_key: str) -> str | None:
    try:
        r = httpx.get(
            HUNTER_DOMAIN_URL,
            params={"domain": domain, "api_key": api_key, "limit": 5},
            timeout=20.0,
        )
        r.raise_for_status()
        emails = (r.json().get("data") or {}).get("emails") or []
        candidates = [e.get("value") for e in emails if e.get("value")]
        contact = pick_best_email(candidates)
        if contact:
            return contact
        return pick_best_email([e.get("value", "") for e in emails if e.get("type") == "generic"])
    except Exception as exc:
        print(f"  Hunter.io skip ({domain}): {exc}")
        return None


def enrich_email_from_website(client: httpx.Client, website: str, hunter_key: str | None) -> tuple[str, str]:
    """Return (email, source). source: website | hunter | '' """
    if not website:
        return "", ""
    parsed = urlparse(website if "://" in website else f"https://{website}")
    domain = parsed.netloc or parsed.path.split("/")[0]
    if not domain:
        return "", ""

    if hunter_key:
        found = hunter_domain_search(domain, hunter_key)
        if found:
            return found, "hunter"

    paths = ["", "/contact", "/contact-us", "/about", "/about-us"]
    candidates: list[str] = []
    base = f"{parsed.scheme or 'https'}://{domain}"
    for path in paths:
        url = urljoin(base + "/", path.lstrip("/"))
        try:
            r = client.get(url, follow_redirects=True, timeout=12.0)
            if r.status_code >= 400:
                continue
            ctype = (r.headers.get("content-type") or "").lower()
            if "html" not in ctype and "text" not in ctype:
                continue
            candidates.extend(fetch_emails_from_html(r.text[:500_000]))
        except Exception:
            continue
        time.sleep(0.4)

    email = pick_best_email(candidates)
    return (email or "", "website" if email else "")


def _place_id(raw_id: str) -> str:
    """Normalize Places API (New) id to resource name places/…"""
    pid = (raw_id or "").strip()
    if not pid:
        return ""
    return pid if pid.startswith("places/") else f"places/{pid}"


def _display_name(place: dict) -> str:
    dn = place.get("displayName")
    if isinstance(dn, dict):
        return (dn.get("text") or "").strip()
    return (dn or "").strip() if isinstance(dn, str) else ""


def _places_headers(key: str, field_mask: str) -> dict[str, str]:
    return {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }


def place_details(client: httpx.Client, place_id: str, key: str) -> dict:
    pid = _place_id(place_id)
    if not pid:
        return {}
    r = client.get(
        f"https://places.googleapis.com/v1/{pid}",
        headers=_places_headers(key, DETAILS_FIELD_MASK),
        timeout=20.0,
    )
    if r.status_code >= 400:
        err = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        print(
            f"  Place Details error ({r.status_code}): {err.get('error', {}).get('message', r.text[:200])}",
            file=sys.stderr,
        )
        return {}
    return r.json() or {}


def text_search(client: httpx.Client, query: str, city: str, key: str, limit: int) -> list[dict]:
    results: list[dict] = []
    body: dict = {"textQuery": f"{query} in {city}", "pageSize": min(limit, 20)}
    headers = _places_headers(key, SEARCH_FIELD_MASK)
    while len(results) < limit:
        r = client.post(TEXT_SEARCH_URL, headers=headers, json=body, timeout=25.0)
        if r.status_code >= 400:
            err = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            print(
                f"  Places API error ({r.status_code}): {err.get('error', {}).get('message', r.text[:200])}",
                file=sys.stderr,
            )
            break
        data = r.json()
        for p in data.get("places") or []:
            results.append(p)
            if len(results) >= limit:
                break
        token = data.get("nextPageToken")
        if not token or len(results) >= limit:
            break
        time.sleep(2.1)
        body = {"textQuery": f"{query} in {city}", "pageSize": min(limit, 20), "pageToken": token}
    return results[:limit]


def discover(city: str, queries: list[tuple[str, str]], per_query: int, enrich: bool) -> list[dict]:
    import os

    key = _api_key()
    hunter_key = (os.getenv("HUNTER_API_KEY") or "").strip() or None
    seen_slugs: set[str] = set()
    seen_place_ids: set[str] = set()
    rows: list[dict] = []

    with httpx.Client(
        headers={"User-Agent": "AllyOutreachBot/1.0 (+https://yourfriendally.com)"},
    ) as client:
        for query, vertical in queries:
            print(f"Searching: {query} in {city} …")
            places = text_search(client, query, city, key, per_query)
            for p in places:
                pid = p.get("id") or ""
                if not pid or pid in seen_place_ids:
                    continue
                seen_place_ids.add(pid)
                detail = place_details(client, pid, key)
                name = _display_name(detail) or _display_name(p)
                if not name:
                    continue
                address = detail.get("formattedAddress") or p.get("formattedAddress") or ""
                website = (detail.get("websiteUri") or p.get("websiteUri") or "").strip()
                phone = (detail.get("nationalPhoneNumber") or p.get("nationalPhoneNumber") or "").strip()
                slug = slugify(name, seen_slugs)
                email, email_source = "", ""
                needs_review = "yes"

                if enrich and website:
                    print(f"  Enriching {name} …")
                    email, email_source = enrich_email_from_website(client, website, hunter_key)
                    needs_review = "no" if email else "yes"

                rows.append(
                    {
                        "slug": slug,
                        "businessName": name,
                        "contactName": "",
                        "contactTitle": "",
                        "vertical": vertical,
                        "city": city,
                        "neighborhood": parse_neighborhood(address),
                        "email": email,
                        "phone": phone,
                        "website": website,
                        "teamSize": "",
                        "emailSource": email_source,
                        "needsReview": needs_review,
                        "placeId": pid,
                    }
                )
                time.sleep(0.2)

    return rows


def enrich_csv(path: Path) -> None:
    import os

    hunter_key = (os.getenv("HUNTER_API_KEY") or "").strip() or None
    rows = read_csv(path)
    with httpx.Client(
        headers={"User-Agent": "AllyOutreachBot/1.0 (+https://yourfriendally.com)"},
    ) as client:
        for row in rows:
            if (row.get("email") or "").strip():
                row["needsReview"] = "no"
                continue
            website = (row.get("website") or "").strip()
            if not website:
                continue
            print(f"Enriching {row.get('businessName', row.get('slug', '?'))} …")
            email, source = enrich_email_from_website(client, website, hunter_key)
            if email:
                row["email"] = email
                row["emailSource"] = source
                row["needsReview"] = "no"
            time.sleep(0.5)
    write_csv(path, rows)
    print(f"Updated {path}")


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in CSV_FIELDS})


def sync_to_leads_json(csv_path: Path, json_path: Path) -> None:
    """Merge discovered rows (with email + slug) into frontend outreach-leads.json."""
    rows = read_csv(csv_path)
    existing: dict = {}
    if json_path.is_file():
        existing = json.loads(json_path.read_text(encoding="utf-8"))
    added = 0
    for row in rows:
        slug = (row.get("slug") or "").strip()
        if not slug or not (row.get("businessName") or "").strip():
            continue
        email = (row.get("email") or "").strip()
        if email and not is_plausible_email(email):
            email = ""
        existing[slug] = {
            "businessName": row.get("businessName", ""),
            "contactName": row.get("contactName") or "there",
            "contactTitle": row.get("contactTitle", ""),
            "vertical": row.get("vertical", "default"),
            "city": row.get("city", ""),
            "neighborhood": row.get("neighborhood", ""),
            "email": email,
            "teamSize": row.get("teamSize", ""),
        }
        added += 1
    json_path.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {added} lead(s) → {json_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Discover Ally outreach leads (Google Places)")
    parser.add_argument("--city", default="Boston, MA", help="City/region for text search")
    parser.add_argument("--limit", type=int, default=10, help="Max businesses per query category")
    parser.add_argument("--no-enrich", action="store_true", help="Skip website/Hunter email lookup")
    parser.add_argument("--enrich", metavar="CSV", help="Enrich emails for existing CSV only")
    parser.add_argument(
        "--output",
        default=str(ROOT / "scripts/outreach/discovered-leads.csv"),
        help="Output CSV path",
    )
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Merge CSV into frontend/src/data/outreach-leads.json",
    )
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Only sync --output CSV to outreach-leads.json (no discover)",
    )
    args = parser.parse_args()
    out = Path(args.output)
    json_path = ROOT / "frontend/src/data/outreach-leads.json"

    if args.sync_only:
        sync_to_leads_json(out, json_path)
        return

    if args.enrich:
        enrich_csv(Path(args.enrich))
        if args.sync:
            sync_to_leads_json(Path(args.enrich), json_path)
        return

    rows = discover(
        city=args.city,
        queries=DEFAULT_QUERIES,
        per_query=max(1, min(args.limit, 30)),
        enrich=not args.no_enrich,
    )
    write_csv(out, rows)
    with_email = sum(1 for r in rows if (r.get("email") or "").strip())
    print(f"\nWrote {len(rows)} leads → {out}")
    print(f"  {with_email} with email, {len(rows) - with_email} need manual contactName/email")
    print("\nNext:")
    print("  1. Open CSV — add contactName where you know it (LinkedIn)")
    print("  2. python scripts/outreach/discover_leads.py --enrich", out)
    print("  3. node scripts/outreach/generate-emails.mjs --csv", out)
    if args.sync:
        sync_to_leads_json(out, json_path)


if __name__ == "__main__":
    main()
