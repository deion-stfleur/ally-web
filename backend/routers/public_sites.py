from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db_optional
from services.site_service import serve_site_file

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("/{slug}")
async def get_site_index(
    slug: str,
    preview: str | None = Query(None),
    db: AsyncSession | None = Depends(get_db_optional),
) -> Response:
    return await _serve(slug, "index.html", preview, db)


@router.get("/{slug}/{file_path:path}")
async def get_site_asset(
    slug: str,
    file_path: str,
    preview: str | None = Query(None),
    db: AsyncSession | None = Depends(get_db_optional),
) -> Response:
    return await _serve(slug, file_path, preview, db)


async def _serve(
    slug: str,
    file_path: str,
    preview: str | None,
    db: AsyncSession | None,
) -> Response:
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured.",
        )
    served = await serve_site_file(
        db, slug=slug, file_path=file_path, preview_token=preview
    )
    if served is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    content, media_type = served
    if media_type.startswith("text/html"):
        return HTMLResponse(content=content, media_type=media_type)
    return Response(content=content.encode("utf-8") if isinstance(content, str) else content, media_type=media_type)
