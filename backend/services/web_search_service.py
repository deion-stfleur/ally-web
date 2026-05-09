from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx

# DuckDuckGo's classic /html endpoint redirects to html.duckduckgo.com and often returns 400 for
# server / bot clients. Lite HTML still returns parseable results as of 2026.
_LITE_URL = "https://lite.duckduckgo.com/lite/"
_RESULT_LINK_RE = re.compile(
    r'<a[^>]+href="(//duckduckgo\.com/l/\?uddg=[^"]+)"[^>]*class=[\'"]result-link[\'"][^>]*>([\s\S]*?)</a>'
    r'|<a[^>]+class=[\'"]result-link[\'"][^>]*href="(//duckduckgo\.com/l/\?uddg=[^"]+)"[^>]*>([\s\S]*?)</a>',
    re.IGNORECASE,
)
_SNIPPET_TD_RE = re.compile(
    r'class=[\'"]result-snippet[\'"][^>]*>([\s\S]*?)</td>',
    re.IGNORECASE,
)
_TAG_RE = re.compile(r"<[^>]+>")

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _clean_html(s: str) -> str:
    s = (s or "").strip()
    s = unescape(s)
    s = s.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    s = s.replace("&lt;", "<").replace("&gt;", ">")
    s = _TAG_RE.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def _normalize_result_url(href: str) -> str | None:
    """Resolve a result-link href to a real URL (DDG redirect or direct https)."""
    h = (href or "").strip().replace("&amp;", "&")
    if not h:
        return None
    if h.startswith("//"):
        h = "https:" + h
    if "uddg=" in h:
        qs = urlparse(h).query
        uddg = (parse_qs(qs).get("uddg") or [""])[0]
        return unquote(uddg) if uddg else None
    if h.startswith("http://") or h.startswith("https://"):
        host = urlparse(h).netloc.lower()
        if "duckduckgo.com" in host:
            return None
        return h
    return None


def _is_sponsored_or_tracker_url(url: str) -> bool:
    u = (url or "").lower()
    if "duckduckgo.com/y.js" in u:
        return True
    if "duckduckgo.com/l/?" in u and "uddg=" not in u:
        return True
    return False


def _parse_lite_html(html: str, *, max_results: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    snippets = _SNIPPET_TD_RE.findall(html or "")
    for i, m in enumerate(_RESULT_LINK_RE.finditer(html or "")):
        if len(out) >= max_results:
            break
        href = m.group(1) or m.group(3)
        title_html = m.group(2) or m.group(4)
        title = _clean_html(title_html)
        snippet = _clean_html(snippets[i]) if i < len(snippets) else ""
        dest = _normalize_result_url(href)
        if not title or not dest or _is_sponsored_or_tracker_url(dest):
            continue
        out.append({"title": title, "url": dest, "snippet": snippet})
    return out


def _post_headers(base_headers: dict[str, str]) -> dict[str, str]:
    h = dict(base_headers)
    h["Content-Type"] = "application/x-www-form-urlencoded"
    h["Origin"] = "https://lite.duckduckgo.com"
    h["Referer"] = "https://lite.duckduckgo.com/lite/"
    return h


async def web_search(*, query: str, max_results: int = 5) -> str:
    """
    Lightweight DuckDuckGo Lite HTML scraping (no API key).
    Returns a JSON string with {query, results:[{title,url,snippet}]}.
    """
    q = (query or "").strip()
    if not q:
        return json.dumps({"error": "query_required"})
    try:
        k = int(max_results or 5)
    except Exception:
        k = 5
    k = max(1, min(8, k))

    headers = {
        "User-Agent": _DEFAULT_UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    html = ""
    fetch_note: str | None = None
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            resp = await client.get(_LITE_URL, params={"q": q}, headers=headers)
            resp.raise_for_status()
            html = resp.text or ""
            results = _parse_lite_html(html, max_results=k)
            if not results:
                # Datacenter IPs often get an empty lite table on GET; POST form often still works.
                post = await client.post(
                    _LITE_URL,
                    data={"q": q, "kl": "us-en"},
                    headers=_post_headers(headers),
                )
                post.raise_for_status()
                html = post.text or ""
                fetch_note = "ddg_lite_post_fallback"
    except Exception as e:
        return json.dumps({"query": q, "results": [], "error": "fetch_failed", "detail": str(e)})

    results = _parse_lite_html(html, max_results=k)
    payload: dict[str, Any] = {"query": q, "results": results}
    if fetch_note:
        payload["source"] = fetch_note
    if not results:
        payload["note"] = (
            "no_results_parsed — page may have changed or the search provider blocked this server"
        )
    return json.dumps(payload)
