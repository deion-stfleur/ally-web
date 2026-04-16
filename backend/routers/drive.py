from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from deps import get_current_session
from models.schemas import DriveFileListResponse, DriveFileRow, DriveFileTextResponse
from services import drive_service
from services.session_store import UserSession

router = APIRouter(prefix="/drive", tags=["drive"])


@router.get("/files", response_model=DriveFileListResponse)
def drive_list_files(
    session: UserSession = Depends(get_current_session),
    page_size: int = Query(default=25, ge=1, le=50),
    q: str = Query(default="", max_length=2000, description="Extra Drive q= fragment"),
) -> DriveFileListResponse:
    try:
        rows = drive_service.list_workspace_files(
            session.credentials, page_size=page_size, extra_query=q
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return DriveFileListResponse(
        files=[
            DriveFileRow(
                id=str(r["id"]),
                name=r.get("name"),
                mimeType=r.get("mimeType"),
                modifiedTime=r.get("modifiedTime"),
            )
            for r in rows
            if r.get("id")
        ]
    )


@router.get("/files/{file_id}/text", response_model=DriveFileTextResponse)
def drive_file_text(
    file_id: str,
    session: UserSession = Depends(get_current_session),
) -> DriveFileTextResponse:
    try:
        text = drive_service.get_file_plain_text(session.credentials, file_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return DriveFileTextResponse(file_id=file_id, text=text)
