from __future__ import annotations

import json
import re
from typing import Any

import httpx


_A_RE = re.compile(
    r'<a[^>]+class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>',
    re.IGNORECASE,
)
_SNIPPET_RE = re.compile(
    r'<a[^>]+class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)</a>',
    re.IGNORECASE,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean_html(s: str) -> str:
    s = (s or "").strip()
    s = s.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    s = s.replace("&lt;", "<").replace("&gt;", ">")
    s = _TAG_RE.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


async def web_search(*, query: str, max_results: int = 5) -> str:
    """
    Lightweight DuckDuckGo HTML scraping (no API key).
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

    url = "https://duckduckgo.com/html/"
    headers = {
        "User-Agent": "AllyBot/1.0 (+https://example.com)",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        resp = await client.get(url, params={"q": q}, headers=headers)
        resp.raise_for_status()
        html = resp.text or ""

    links = _A_RE.findall(html)
    snippets = _SNIPPET_RE.findall(html)
    out: list[dict[str, Any]] = []
    for i, (href, title_html) in enumerate(links[:k]):
        title = _clean_html(title_html)
        snippet = _clean_html(snippets[i]) if i < len(snippets) else ""
        if not href or not title:
            continue
        out.append({"title": title, "url": href, "snippet": snippet})

    return json.dumps({"query": q, "results": out})

