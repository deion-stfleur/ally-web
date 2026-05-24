"""Ally vibe-coding sites: multi-file projects, versions, preview + publish."""

from __future__ import annotations

import logging
import mimetypes
import re
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from db.models import PublishedSite, SiteFile, SiteVersion

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
_PATH_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_./-]*$")
_MAX_FILE_BYTES = 400_000
_MAX_FILES = 32
_MAX_VERSIONS_KEEP = 40


class SiteServiceError(ValueError):
    pass


@dataclass(frozen=True)
class SiteToolContext:
    user_id: uuid.UUID
    db: AsyncSession


def slugify(title: str) -> str:
    s = (title or "page").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:48] or "page"


def normalize_slug(raw: str | None, fallback_title: str) -> str:
    s = slugify(raw or fallback_title)
    if not _SLUG_RE.match(s):
        s = slugify(fallback_title)
    return s


def public_site_url(slug: str) -> str:
    base = (settings.ally_sites_public_base_url or settings.frontend_url).rstrip("/")
    return f"{base}/s/{slug}"


def preview_site_url(slug: str, preview_token: str) -> str:
    return f"{public_site_url(slug)}?preview={preview_token}"


def normalize_file_path(path: str) -> str:
    p = (path or "").strip().replace("\\", "/").lstrip("/")
    if not p or ".." in p.split("/"):
        raise SiteServiceError("invalid file path")
    if not _PATH_RE.match(p):
        raise SiteServiceError(f"invalid path: {path}")
    return p


def _parse_files_list(raw: Any) -> dict[str, str]:
    if not isinstance(raw, list):
        raise SiteServiceError("files must be an array of {path, content}")
    out: dict[str, str] = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        path = normalize_file_path(str(item.get("path") or ""))
        content = str(item.get("content") or "")
        if len(content.encode("utf-8")) > _MAX_FILE_BYTES:
            raise SiteServiceError(f"file too large: {path}")
        out[path] = content
    if len(out) > _MAX_FILES:
        raise SiteServiceError(f"max {_MAX_FILES} files per version")
    return out


def _media_type(path: str) -> str:
    mt, _ = mimetypes.guess_type(path)
    if mt:
        return mt
    if path.endswith(".html") or path.endswith(".htm"):
        return "text/html; charset=utf-8"
    return "application/octet-stream"


async def _get_owned_site(
    db: AsyncSession, *, user_id: uuid.UUID, slug: str
) -> PublishedSite | None:
    s = (slug or "").strip().lower()
    if not s or not _SLUG_RE.match(s):
        return None
    r = await db.execute(select(PublishedSite).where(PublishedSite.slug == s))
    row = r.scalar_one_or_none()
    if row is None or row.user_id != user_id:
        return None
    return row


async def _get_site_by_slug(db: AsyncSession, slug: str) -> PublishedSite | None:
    s = (slug or "").strip().lower()
    if not s or not _SLUG_RE.match(s):
        return None
    r = await db.execute(select(PublishedSite).where(PublishedSite.slug == s))
    return r.scalar_one_or_none()


async def _load_version_files(db: AsyncSession, version_id: uuid.UUID) -> dict[str, str]:
    r = await db.execute(select(SiteFile).where(SiteFile.version_id == version_id))
    return {f.path: f.content for f in r.scalars().all()}


async def _next_version_number(db: AsyncSession, site_id: uuid.UUID) -> int:
    r = await db.execute(
        select(func.max(SiteVersion.version_number)).where(SiteVersion.site_id == site_id)
    )
    current = r.scalar_one_or_none()
    return int(current or 0) + 1


async def _create_version(
    db: AsyncSession,
    *,
    site: PublishedSite,
    files: dict[str, str],
    note: str | None,
) -> SiteVersion:
    if "index.html" not in files and "index.htm" not in files:
        raise SiteServiceError("each version must include index.html")
    ver_num = await _next_version_number(db, site.id)
    version = SiteVersion(
        site_id=site.id,
        version_number=ver_num,
        note=(note or "").strip()[:500] or None,
    )
    db.add(version)
    await db.flush()
    for path, content in files.items():
        db.add(SiteFile(version_id=version.id, path=path, content=content))
    site.draft_version_id = version.id
    site.html_content = files.get("index.html") or files.get("index.htm")
    await db.flush()
    return version


async def _merge_draft_files(
    db: AsyncSession, site: PublishedSite, updates: dict[str, str]
) -> dict[str, str]:
    base: dict[str, str] = {}
    if site.draft_version_id:
        base = await _load_version_files(db, site.draft_version_id)
    elif site.html_content:
        base = {"index.html": site.html_content}
    merged = {**base, **updates}
    return merged


async def get_or_create_site(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    slug: str,
    title: str,
) -> tuple[PublishedSite, bool]:
    norm = normalize_slug(slug, title)
    r = await db.execute(select(PublishedSite).where(PublishedSite.slug == norm))
    row = r.scalar_one_or_none()
    if row is not None:
        if row.user_id != user_id:
            norm = f"{norm}-{str(user_id)[:8]}"
            r2 = await db.execute(select(PublishedSite).where(PublishedSite.slug == norm))
            row = r2.scalar_one_or_none()
        if row is not None:
            if row.user_id == user_id:
                row.title = title.strip()[:200]
                return row, False
    site = PublishedSite(
        user_id=user_id,
        slug=norm,
        title=title.strip()[:200],
        preview_token=str(uuid.uuid4()),
        is_published=False,
    )
    db.add(site)
    await db.flush()
    return site, True


def site_tool_result(site: PublishedSite, *, version: SiteVersion | None = None) -> dict[str, Any]:
    ver = version.version_number if version else None
    return {
        "ok": True,
        "slug": site.slug,
        "title": site.title,
        "version": ver,
        "is_published": site.is_published,
        "public_url": public_site_url(site.slug) if site.is_published else None,
        "preview_url": preview_site_url(site.slug, site.preview_token),
        "design_tokens": site.design_tokens,
    }


async def create_site_project(
    ctx: SiteToolContext,
    *,
    slug: str | None,
    title: str,
    files: list[dict[str, Any]],
    design_tokens: dict[str, Any] | None = None,
    version_note: str | None = None,
    publish: bool = False,
) -> dict[str, Any]:
    site, _created = await get_or_create_site(
        ctx.db, user_id=ctx.user_id, slug=slug or title, title=title
    )
    if design_tokens and isinstance(design_tokens, dict):
        site.design_tokens = design_tokens
    parsed = _parse_files_list(files)
    version = await _create_version(
        ctx.db, site=site, files=parsed, note=version_note or "initial vibe build"
    )
    if publish:
        site.is_published = True
        site.published_version_id = version.id
    await ctx.db.flush()
    return site_tool_result(site, version=version)


async def write_site_files(
    ctx: SiteToolContext,
    *,
    slug: str,
    files: list[dict[str, Any]],
    version_note: str | None = None,
) -> dict[str, Any]:
    site = await _get_owned_site(ctx.db, user_id=ctx.user_id, slug=slug)
    if site is None:
        raise SiteServiceError(f"site not found: {slug}")
    updates = _parse_files_list(files)
    merged = await _merge_draft_files(ctx.db, site, updates)
    version = await _create_version(
        ctx.db,
        site=site,
        files=merged,
        note=version_note or "vibe update",
    )
    await ctx.db.flush()
    return site_tool_result(site, version=version)


async def read_site_file(
    ctx: SiteToolContext,
    *,
    slug: str,
    path: str,
    use_published: bool = False,
) -> dict[str, Any]:
    site = await _get_owned_site(ctx.db, user_id=ctx.user_id, slug=slug)
    if site is None:
        raise SiteServiceError(f"site not found: {slug}")
    norm_path = normalize_file_path(path)
    vid = site.published_version_id if use_published else site.draft_version_id
    if vid is None:
        raise SiteServiceError("no version available")
    files = await _load_version_files(ctx.db, vid)
    if norm_path not in files:
        raise SiteServiceError(f"file not in project: {norm_path}")
    content = files[norm_path]
    return {
        "slug": site.slug,
        "path": norm_path,
        "content": content,
        "chars": len(content),
        "use_published": use_published,
    }


async def list_site_files(
    ctx: SiteToolContext,
    *,
    slug: str,
    use_published: bool = False,
) -> dict[str, Any]:
    site = await _get_owned_site(ctx.db, user_id=ctx.user_id, slug=slug)
    if site is None:
        raise SiteServiceError(f"site not found: {slug}")
    vid = site.published_version_id if use_published else site.draft_version_id
    if vid is None:
        return {"slug": site.slug, "files": [], "version": None}
    r = await ctx.db.execute(
        select(SiteVersion).where(SiteVersion.id == vid)
    )
    ver = r.scalar_one_or_none()
    files = await _load_version_files(ctx.db, vid)
    return {
        "slug": site.slug,
        "version": ver.version_number if ver else None,
        "files": sorted(files.keys()),
        "use_published": use_published,
    }


async def publish_site_project(ctx: SiteToolContext, *, slug: str) -> dict[str, Any]:
    site = await _get_owned_site(ctx.db, user_id=ctx.user_id, slug=slug)
    if site is None:
        raise SiteServiceError(f"site not found: {slug}")
    if not site.draft_version_id:
        raise SiteServiceError("nothing to publish — create files first")
    site.is_published = True
    site.published_version_id = site.draft_version_id
    await ctx.db.flush()
    r = await ctx.db.execute(select(SiteVersion).where(SiteVersion.id == site.draft_version_id))
    ver = r.scalar_one_or_none()
    return site_tool_result(site, version=ver)


async def serve_site_file(
    db: AsyncSession,
    *,
    slug: str,
    file_path: str,
    preview_token: str | None = None,
) -> tuple[str, str] | None:
    site = await _get_site_by_slug(db, slug)
    if site is None:
        return None

    use_preview = False
    if preview_token and preview_token.strip() == site.preview_token:
        use_preview = True

    if use_preview:
        vid = site.draft_version_id
    elif site.is_published and site.published_version_id:
        vid = site.published_version_id
    else:
        return None

    if vid is None and site.html_content:
        if file_path in ("", "index.html", "index.htm"):
            return site.html_content, "text/html; charset=utf-8"
        return None

    if vid is None:
        return None

    norm = normalize_file_path(file_path or "index.html")
    r = await db.execute(
        select(SiteFile).where(SiteFile.version_id == vid, SiteFile.path == norm)
    )
    f = r.scalar_one_or_none()
    if f is None:
        return None
    return f.content, _media_type(norm)


# Legacy single-file API (chat callbacks) — delegates to project create.
async def save_published_site(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    slug: str,
    title: str,
    html_content: str,
) -> PublishedSite:
    ctx = SiteToolContext(user_id=user_id, db=db)
    await create_site_project(
        ctx,
        slug=slug,
        title=title,
        files=[{"path": "index.html", "content": html_content}],
        version_note="legacy html publish",
        publish=True,
    )
    row = await _get_owned_site(db, user_id=user_id, slug=slug)
    assert row is not None
    return row


async def get_public_site(db: AsyncSession, slug: str) -> PublishedSite | None:
    return await _get_site_by_slug(db, slug)
